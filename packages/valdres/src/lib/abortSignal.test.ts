import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

describe("abort signal support for async selectors", () => {
    const throwIfAborted = (signal: AbortSignal) => {
        if (signal.aborted) {
            throw new Error("aborted")
        }
    }

    test("selector get function receives an AbortSignal as second argument", () => {
        const store1 = store()
        const atom1 = atom(1)
        let receivedSignal: AbortSignal | undefined
        const selector1 = selector((get, { signal }) => {
            receivedSignal = signal
            return get(atom1)
        })
        store1.get(selector1)
        expect(receivedSignal).toBeInstanceOf(AbortSignal)
        expect(receivedSignal!.aborted).toBe(false)
    })

    test("signal is aborted on re-evaluation (unmounted)", async () => {
        const store1 = store()
        const countAtom = atom(1)
        const signals: AbortSignal[] = []

        const asyncSelector = selector((get, { signal }) => {
            const count = get(countAtom)
            signals.push(signal)
            return new Promise<number>(r => {
                // Don't resolve yet - we want to check abort state
            })
        })

        // First evaluation
        store1.get(asyncSelector)
        expect(signals).toHaveLength(1)
        expect(signals[0]!.aborted).toBe(false)

        // Change dependency — triggers re-evaluation
        store1.set(countAtom, 2)
        store1.get(asyncSelector)
        expect(signals).toHaveLength(2)

        // First signal should be aborted, second should not
        expect(signals[0]!.aborted).toBe(true)
        expect(signals[1]!.aborted).toBe(false)
    })

    test("signal is aborted on re-evaluation (mounted/subscribed)", async () => {
        const store1 = store()
        const countAtom = atom(1)
        const signals: AbortSignal[] = []

        const asyncSelector = selector((get, { signal }) => {
            const count = get(countAtom)
            signals.push(signal)
            return new Promise<number>(r => {})
        })

        // Subscribe to mount the selector
        store1.sub(asyncSelector, () => {})
        expect(signals).toHaveLength(1)
        expect(signals[0]!.aborted).toBe(false)

        // Change dependency — propagation triggers re-evaluation
        store1.set(countAtom, 2)
        expect(signals).toHaveLength(2)

        // First signal should be aborted, second should not
        expect(signals[0]!.aborted).toBe(true)
        expect(signals[1]!.aborted).toBe(false)
    })

    test("signal is NOT aborted when unsubscribing", async () => {
        const store1 = store()
        const countAtom = atom(1)
        const signals: AbortSignal[] = []

        const asyncSelector = selector((get, { signal }) => {
            const count = get(countAtom)
            signals.push(signal)
            return new Promise<number>(r => {})
        })

        const unsub = store1.sub(asyncSelector, () => {})
        expect(signals).toHaveLength(1)
        expect(signals[0]!.aborted).toBe(false)

        // Unsubscribe should NOT abort the signal
        unsub()
        expect(signals[0]!.aborted).toBe(false)
    })

    test("each store gets its own abort signal for the same selector", () => {
        const store1 = store()
        const store2 = store()
        const countAtom = atom(1)
        const signals: AbortSignal[] = []

        const asyncSelector = selector((get, { signal }) => {
            const count = get(countAtom)
            signals.push(signal)
            return new Promise<number>(r => {})
        })

        // Evaluate in store1
        store1.get(asyncSelector)
        expect(signals).toHaveLength(1)

        // Evaluate in store2
        store2.get(asyncSelector)
        expect(signals).toHaveLength(2)

        // They should be different signals
        expect(signals[0]).not.toBe(signals[1])

        // Re-evaluate in store1 — only store1's signal should be aborted
        store1.set(countAtom, 2)
        store1.get(asyncSelector)
        expect(signals).toHaveLength(3)
        expect(signals[0]!.aborted).toBe(true) // store1's old signal
        expect(signals[1]!.aborted).toBe(false) // store2's signal — untouched
    })

    test("rejected async selector does not cause unhandled promise rejection", async () => {
        const store1 = store()
        const countAtom = atom(1)
        const resolvers: (() => void)[] = []

        const asyncSelector = selector((get, { signal }) => {
            const count = get(countAtom)
            return new Promise<number>((resolve, reject) => {
                resolvers.push(() => {
                    if (signal.aborted) {
                        reject(new Error("aborted"))
                    } else {
                        resolve(count)
                    }
                })
            })
        })

        // Subscribe so propagation works
        store1.sub(asyncSelector, () => {})
        expect(resolvers).toHaveLength(1)

        // Change dependency — first signal aborted, new evaluation
        store1.set(countAtom, 2)
        expect(resolvers).toHaveLength(2)

        // Resolve both — first should reject (aborted), second should resolve
        // This should NOT cause unhandled promise rejections
        resolvers[0]!()
        resolvers[1]!()
        await new Promise(r => setTimeout(r, 0))
        expect(store1.get(asyncSelector)).toBe(2)
    })
})
