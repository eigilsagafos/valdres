import { describe, test, expect, mock } from "bun:test"
import { atom } from "../src/atom"
import { selector } from "../src/selector"
import { createStoreWithSelectorSet } from "../src/createStoreWithSelectorSet"
import { isPromiseLike } from "../src/utils/isPromiseLike"
import { isSuspendError } from "../src/lib/initSelector"
import { wait } from "./utils/wait"

describe("async selectors", () => {
    test("selector returning a Promise stores the Promise then resolves", async () => {
        const s = createStoreWithSelectorSet()
        const sel = selector(() => Promise.resolve(42))

        const value = s.get(sel)
        expect(isPromiseLike(value)).toBe(true)

        await wait(10)
        expect(s.get(sel)).toBe(42)
    })

    test("subscriber is notified when async selector resolves", async () => {
        const s = createStoreWithSelectorSet()
        let resolve!: (v: number) => void
        const sel = selector(() => new Promise<number>(r => (resolve = r)))

        const cb = mock(() => {})
        s.sub(sel, cb)
        expect(cb).toHaveBeenCalledTimes(0)

        resolve(99)
        await wait(10)
        expect(cb).toHaveBeenCalledTimes(1)
        expect(s.get(sel)).toBe(99)
    })

    test("deps accessed after await are tracked via lateGet", async () => {
        const s = createStoreWithSelectorSet()
        const base = atom(1)

        const sel = selector((get: any) => {
            const promise = new Promise<number>(resolve => {
                setTimeout(() => {
                    // This get() call happens after evaluateSelector returns,
                    // so it goes through lateGet
                    resolve(get(base) * 10)
                }, 5)
            })
            return promise
        })

        const cb = mock(() => {})
        s.sub(sel, cb)

        await wait(20)
        expect(s.get(sel)).toBe(10)
        expect(cb).toHaveBeenCalledTimes(1)

        // Change the late-bound dep — selector should re-evaluate.
        // Notified twice: once for value→Promise transition, once for Promise→resolved.
        cb.mockClear()
        s.set(base, 2)
        await wait(20)
        expect(s.get(sel)).toBe(20)
        expect(cb).toHaveBeenCalledTimes(2)
    })

    test("suspension resolves and derived selector re-evaluates", async () => {
        const s = createStoreWithSelectorSet()
        let resolve!: (v: number) => void
        const asyncSel = selector(
            () => new Promise<number>(r => (resolve = r)),
        )

        // A sync selector that gets an async selector suspends during eval
        // and the Promise is stored
        const derived = selector((get: any) => get(asyncSel))

        const value = s.get(derived)
        expect(isPromiseLike(value)).toBe(true)

        // After resolving, the derived selector should re-evaluate
        // to the resolved value
        resolve(42)
        await wait(10)
        expect(s.get(derived)).toBe(42)
    })

    test("isSuspendError detects SuspendAndWaitForResolveError", () => {
        const s = createStoreWithSelectorSet()
        const asyncSel = selector(() => new Promise<void>(() => {}))

        let caughtError: unknown
        const derived = selector((get: any) => {
            try {
                return get(asyncSel)
            } catch (e) {
                caughtError = e
                throw e
            }
        })

        s.get(derived)
        expect(isSuspendError(caughtError)).toBe(true)
        expect(isSuspendError(new Error("not a suspend"))).toBe(false)
        expect(isSuspendError(null)).toBe(false)
        expect(isSuspendError({ promise: Promise.resolve() })).toBe(false)
    })

    test("async selector chain: derived async selector gets another async selector", async () => {
        const s = createStoreWithSelectorSet()
        const base = atom(1)

        let resolve1!: () => void
        const async1 = selector((get: any) => {
            const count = get(base)
            return new Promise<number>(r => {
                resolve1 = () => r(count)
            })
        })

        // This derived selector wraps get in a try/catch to handle the
        // SuspendAndWaitForResolveError (which is what the jotai adapter does)
        const async2 = selector((get: any) => {
            let val: any
            try {
                val = get(async1)
            } catch (e: any) {
                if (e && isPromiseLike(e.promise)) {
                    val = e.promise
                } else {
                    throw e
                }
            }
            if (isPromiseLike(val)) {
                return val.then((v: number) => v * 2)
            }
            return val * 2
        })

        s.get(async2) // trigger evaluation
        resolve1()
        await wait(10)
        expect(s.get(async2)).toBe(2)

        // Change base, re-evaluate the chain
        s.set(base, 5)
        s.get(async2)
        resolve1()
        await wait(10)
        expect(s.get(async2)).toBe(10)
    })

    test("abort signal is provided and aborted on re-evaluation", async () => {
        const s = createStoreWithSelectorSet()
        const trigger = atom(0)
        const signals: AbortSignal[] = []

        const sel = selector((get: any, options: any) => {
            get(trigger)
            signals.push(options.signal)
            return new Promise<number>(resolve => {
                setTimeout(() => resolve(get(trigger)), 10)
            })
        })

        s.sub(sel, () => {})
        await wait(5)

        // Re-evaluate before the first Promise resolves
        s.set(trigger, 1)

        expect(signals.length).toBe(2)
        expect(signals[0]!.aborted).toBe(true) // first signal aborted
        expect(signals[1]!.aborted).toBe(false) // new signal active
    })

    test("stale promise resolution does not overwrite newer value", async () => {
        const s = createStoreWithSelectorSet()
        const trigger = atom(0)
        let resolvers: ((v: number) => void)[] = []

        const sel = selector((get: any) => {
            const count = get(trigger)
            return new Promise<number>(r => resolvers.push(r))
        })

        s.sub(sel, () => {})

        // First eval creates promise[0]
        s.set(trigger, 1) // re-eval creates promise[1]

        // Resolve the SECOND promise first (newer)
        resolvers[1]!(1)
        await wait(10)
        expect(s.get(sel)).toBe(1)

        // Resolve the FIRST promise (stale) — should NOT overwrite
        resolvers[0]!(0)
        await wait(10)
        expect(s.get(sel)).toBe(1)
    })

    test("late dep cleanup: re-evaluation drops late deps from previous eval", async () => {
        const s = createStoreWithSelectorSet()
        const trigger = atom(0)
        const lateDep = atom(100)

        let evalCount = 0
        const sel = selector((get: any) => {
            get(trigger)
            evalCount++
            if (evalCount === 1) {
                return new Promise<number>(resolve => {
                    setTimeout(() => resolve(get(lateDep)), 5)
                })
            }
            return 42 // second eval is sync, no late dep
        })

        const cb = mock(() => {})
        s.sub(sel, cb)

        // Wait for first eval's Promise to resolve (lateDep registered)
        await wait(20)
        expect(s.get(sel)).toBe(100)

        // Re-evaluate synchronously — no late dep this time
        cb.mockClear()
        s.set(trigger, 1)
        expect(s.get(sel)).toBe(42)

        // Changing lateDep should NOT trigger re-eval since it was
        // dropped during synchronous re-evaluation's dep reconciliation.
        // (lateDep was added via lateGet to stateDependencies, but the
        // sync re-eval rebuilds deps from scratch — only `trigger` remains)
        cb.mockClear()
        s.set(lateDep, 999)
        expect(cb).toHaveBeenCalledTimes(0)
    })
})
