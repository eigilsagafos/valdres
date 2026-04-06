import { describe, test, expect, mock } from "bun:test"
import { atom } from "../src/atom"
import { selector } from "../src/selector"
import { createStoreWithSelectorSet } from "../src/createStoreWithSelectorSet"

describe("late binding (deferred get calls)", () => {
    test("get called in setTimeout registers dep and mounts atom", async () => {
        const s = createStoreWithSelectorSet()
        const a = atom(0)
        const onMount = mock(() => {})
        ;(a as any).onMount = (store: any, state: any) => {
            onMount()
        }

        const sel = selector((get: any) => {
            setTimeout(() => {
                get(a)
            })
            return "initial"
        })

        s.sub(sel, () => {})
        expect(onMount).toHaveBeenCalledTimes(0)

        await new Promise<void>(r => setTimeout(r, 10))
        expect(onMount).toHaveBeenCalledTimes(1)
    })

    test("get called in setTimeout with error still mounts dep", async () => {
        const s = createStoreWithSelectorSet()
        const a = atom(0)
        const onMount = mock(() => {})
        ;(a as any).onMount = (store: any) => {
            onMount()
        }

        const throwingSel = selector(() => {
            throw new Error("always throws")
        })

        const sel = selector((get: any) => {
            setTimeout(() => {
                get(a)
                try {
                    get(throwingSel)
                } catch {
                    // expected
                }
            })
            return "initial"
        })

        s.sub(sel, () => {})
        await new Promise<void>(r => setTimeout(r, 10))
        expect(onMount).toHaveBeenCalledTimes(1)
    })

    test("stale closure from previous evaluation does not register deps", async () => {
        const s = createStoreWithSelectorSet()
        const trigger = atom(0)
        const target = atom(0)
        const onMount = mock(() => {})
        ;(target as any).onMount = (store: any) => {
            onMount()
        }

        let evalCount = 0
        const sel = selector((get: any) => {
            get(trigger)
            const thisEval = ++evalCount
            if (thisEval === 1) {
                // First evaluation: schedule a deferred get
                setTimeout(() => {
                    get(target) // This fires AFTER re-evaluation, so closure is stale
                }, 50)
            }
            return thisEval
        })

        s.sub(sel, () => {})
        expect(evalCount).toBe(1)

        // Re-evaluate before the deferred get fires
        s.set(trigger, 1)
        expect(evalCount).toBe(2)

        // Wait for the stale deferred get to fire
        await new Promise<void>(r => setTimeout(r, 100))
        // target should NOT have been mounted because the closure was stale
        expect(onMount).toHaveBeenCalledTimes(0)
    })

    test("late deps are cleaned up when selector is re-evaluated synchronously", async () => {
        const s = createStoreWithSelectorSet()
        const trigger = atom(0)
        const lateDep = atom(0)

        let evalCount = 0
        const sel = selector((get: any) => {
            get(trigger)
            evalCount++
            if (evalCount === 1) {
                setTimeout(() => {
                    get(lateDep) // late dep on first eval only
                })
            }
            return evalCount
        })

        const listener = mock(() => {})
        s.sub(sel, listener)
        await new Promise<void>(r => setTimeout(r, 10))

        // lateDep is now registered. Re-evaluate to clear it.
        listener.mockClear()
        s.set(trigger, 1) // triggers re-eval (eval 2), no deferred get
        expect(listener).toHaveBeenCalledTimes(1)

        // Changing lateDep should NOT trigger listener — it was cleaned up
        listener.mockClear()
        s.set(lateDep, 99)
        expect(listener).toHaveBeenCalledTimes(0)
    })
})

describe("promise rejection handling in selectors", () => {
    test("rejected promise from selector does not cause unhandled rejection", async () => {
        const s = createStoreWithSelectorSet()
        const sel = selector((get: any) => {
            return new Promise((_, reject) =>
                setTimeout(() => reject(new Error("async fail")), 0),
            )
        })

        s.sub(sel, () => {})

        // If .catch() is missing, bun reports an unhandled rejection and the test fails.
        await new Promise<void>(r => setTimeout(r, 50))
    })

    test("selector value is cleared after promise rejection", async () => {
        const s = createStoreWithSelectorSet()
        let callCount = 0
        const sel = selector((get: any) => {
            callCount++
            if (callCount === 1) {
                return new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("fail")), 0),
                )
            }
            return "recovered"
        })

        s.sub(sel, () => {})
        await new Promise<void>(r => setTimeout(r, 50))

        // After rejection, the stale promise should be removed.
        // Next get should re-evaluate.
        const val = s.get(sel)
        expect(val).toBe("recovered")
    })
})
