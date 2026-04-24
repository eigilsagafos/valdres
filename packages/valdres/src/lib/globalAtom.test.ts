import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { selector } from "../selector"
import { wait } from "../../test/utils/wait"

describe("globalAtom", () => {
    test("set in one store, read from both", () => {
        const store1 = store()
        const store2 = store()
        const numberAtom = atom(0, { global: true })
        store1.set(numberAtom, 1)
        expect(store1.get(numberAtom)).toBe(1)
        expect(store2.get(numberAtom)).toBe(1)
    })

    test("set in txn", () => {
        const store1 = store()
        const store2 = store()
        const numberAtom = atom(0, { global: true })
        store1.txn(({ set }) => {
            set(numberAtom, 1)
        })
        expect(store1.get(numberAtom)).toBe(1)
        expect(store2.get(numberAtom)).toBe(1)
    })

    test("setSelf", () => {
        const store1 = store()
        const store2 = store()
        const numberAtom = atom(0, { global: true })
        numberAtom.setSelf(1)
        expect(store1.get(numberAtom)).toBe(1)
        expect(store2.get(numberAtom)).toBe(1)
        numberAtom.setSelf(2)
        expect(store1.get(numberAtom)).toBe(2)
        expect(store2.get(numberAtom)).toBe(2)
        store1.set(numberAtom, 3)
        expect(store1.get(numberAtom)).toBe(3)
        expect(store2.get(numberAtom)).toBe(3)
        store2.set(numberAtom, 4)
        expect(store1.get(numberAtom)).toBe(4)
        expect(store2.get(numberAtom)).toBe(4)
    })

    test("function as deafault value", () => {
        const store1 = store()
        const store2 = store()
        const numberAtom = atom(() => "it works", { global: true })
        expect(store1.get(numberAtom)).toBe("it works")
        expect(store2.get(numberAtom)).toBe("it works")
    })

    test("onInit", () => {
        const store1 = store()
        const store2 = store()
        const onInit = mock(setSelf => {
            setSelf("init works")
        })
        const testAtom = atom("foo", { global: true, onInit })
        expect(store1.get(testAtom)).toBe("init works")
        expect(store2.get(testAtom)).toBe("init works")
        expect(onInit).toHaveBeenCalledTimes(1)
    })

    test("reset global atom", () => {
        const store1 = store()
        const store2 = store()
        let initialized = false
        const onInit = mock(() => {
            initialized = true
            return () => {
                initialized = false
            }
        })
        const testAtom = atom("foo", { global: true, onInit })
        expect(initialized).toBe(false)
        expect(store1.get(testAtom)).toBe("foo")
        expect(initialized).toBe(true)
        expect(store2.get(testAtom)).toBe("foo")
        testAtom.setSelf("set self")
        expect(store1.get(testAtom)).toBe("set self")
        expect(store2.get(testAtom)).toBe("set self")
        testAtom.resetSelf()
        expect(initialized).toBe(false)
        expect(store1.get(testAtom)).toBe("foo")
        expect(initialized).toBe(true)
        expect(store2.get(testAtom)).toBe("foo")
        store1.sub(testAtom, () => {})
    })

    test("reset support for global atom with selectors", () => {
        const store1 = store()
        const store2 = store()
        const testAtom = atom(3, { global: true, name: "Global test" })
        const testSelector = selector(get => get(testAtom) * 2)
        const sub1cb = mock(() => {})
        const sub2cb = mock(() => {})
        store1.sub(testSelector, sub1cb)
        store2.sub(testSelector, sub2cb)
        expect(sub1cb).toHaveBeenCalledTimes(0)
        expect(sub2cb).toHaveBeenCalledTimes(0)
        expect(store1.get(testSelector)).toBe(6)
        expect(store2.get(testSelector)).toBe(6)
        testAtom.setSelf(5)
        expect(sub1cb).toHaveBeenCalledTimes(1)
        expect(sub2cb).toHaveBeenCalledTimes(1)
        expect(store1.get(testSelector)).toBe(10)
        expect(store2.get(testSelector)).toBe(10)
        testAtom.resetSelf()
        expect(sub1cb).toHaveBeenCalledTimes(2)
        expect(sub2cb).toHaveBeenCalledTimes(2)
        expect(store1.get(testSelector)).toBe(6)
        expect(store2.get(testSelector)).toBe(6)
    })

    test("reset support for global atom with subscriptions", () => {
        const store1 = store()
        const store2 = store()
        const testAtom = atom(3, { global: true })
        const sub1cb = mock(() => {})
        const sub2cb = mock(() => {})
        store1.sub(testAtom, sub1cb)
        store2.sub(testAtom, sub2cb)
        expect(store1.get(testAtom)).toBe(3)
        expect(store2.get(testAtom)).toBe(3)
        expect(sub1cb).toHaveBeenCalledTimes(0)
        expect(sub2cb).toHaveBeenCalledTimes(0)
        testAtom.setSelf(5)
        expect(sub1cb).toHaveBeenCalledTimes(1)
        expect(sub2cb).toHaveBeenCalledTimes(1)
        expect(store1.get(testAtom)).toBe(5)
        expect(store2.get(testAtom)).toBe(5)
        testAtom.resetSelf()
        expect(sub1cb).toHaveBeenCalledTimes(2)
        expect(sub2cb).toHaveBeenCalledTimes(2)
        expect(store1.get(testAtom)).toBe(3)
        expect(store2.get(testAtom)).toBe(3)
    })

    test("subscribe to global atom adds store to atom", () => {
        const store1 = store()
        const testAtom = atom(0, { global: true })
        const callback = mock(() => {})
        store1.sub(testAtom, callback)
        expect(testAtom.stores).toHaveLength(2) // TODO: Should we exclude the globalStore
        expect(callback).toHaveBeenCalledTimes(0)
        testAtom.setSelf(1)
        expect(callback).toHaveBeenCalledTimes(1)
        testAtom.setSelf(2)
        expect(callback).toHaveBeenCalledTimes(2)
    })

    test("getSelf", () => {
        expect(atom(1, { global: true }).getSelf()).toBe(1)
    })

    test("detach removes store from global atom stores set", () => {
        const store1 = store()
        const store2 = store()
        const testAtom = atom(0, { global: true })
        store1.get(testAtom)
        store2.get(testAtom)
        // Both stores should be tracked (plus globalStore)
        const storesBefore = testAtom.stores.size
        expect(storesBefore).toBeGreaterThanOrEqual(2)
        testAtom.detach(store1.data)
        expect(testAtom.stores.size).toBe(storesBefore - 1)
    })

    test("detached store no longer receives cross-store updates", () => {
        const store1 = store()
        const store2 = store()
        const testAtom = atom(0, { global: true })
        store1.get(testAtom)
        store2.get(testAtom)
        testAtom.detach(store1.data)
        store2.set(testAtom, 42)
        // store1 should NOT have been updated since it's detached
        expect(store1.get(testAtom)).not.toBe(42)
    })

    test("onReset cleanup is called exactly once per resetSelf", () => {
        const store1 = store()
        const store2 = store()
        const store3 = store()
        const onResetMock = mock(() => {})
        const testAtom = atom("foo", {
            global: true,
            onInit: () => onResetMock,
        })
        store1.get(testAtom)
        store2.get(testAtom)
        store3.get(testAtom)
        testAtom.resetSelf()
        expect(onResetMock).toHaveBeenCalledTimes(1)
    })

    test("resetSelf recovers if subscriber throws", () => {
        const store1 = store()
        const store2 = store()
        const testAtom = atom(0, { global: true })
        store1.get(testAtom)
        store2.get(testAtom)
        testAtom.setSelf(42)
        // Subscribe with a throwing callback on store1 AFTER initial set
        let shouldThrow = true
        store1.sub(testAtom, () => {
            if (shouldThrow) throw new Error("subscriber blew up")
        })
        // resetSelf triggers propagation which will throw from store1's subscriber
        try {
            testAtom.resetSelf()
        } catch {
            // expected
        }
        // After the error, cross-store sync should still work
        shouldThrow = false
        testAtom.setSelf(99)
        expect(store1.get(testAtom)).toBe(99)
        expect(store2.get(testAtom)).toBe(99)
    })

    test("resetSelf works correctly with multiple stores", () => {
        const store1 = store()
        const store2 = store()
        const store3 = store()
        const testAtom = atom(0, { global: true })
        store1.get(testAtom)
        store2.get(testAtom)
        store3.get(testAtom)
        testAtom.setSelf(99)
        expect(store1.get(testAtom)).toBe(99)
        expect(store2.get(testAtom)).toBe(99)
        expect(store3.get(testAtom)).toBe(99)
        // resetSelf should reset all stores without errors
        testAtom.resetSelf()
        expect(store1.get(testAtom)).toBe(0)
        expect(store2.get(testAtom)).toBe(0)
        expect(store3.get(testAtom)).toBe(0)
    })

    test("global atom with maxAge only calls defaultValue once per interval across stores", async () => {
        let callCount = 0
        const testAtom = atom(
            () => {
                callCount++
                return callCount
            },
            { global: true, maxAge: 50 },
        )

        const store1 = store()
        const store2 = store()

        const cb1 = mock(() => {})
        const cb2 = mock(() => {})

        // Subscribe in both stores — bug causes two independent intervals
        const unsub1 = store1.sub(testAtom, cb1)
        const unsub2 = store2.sub(testAtom, cb2)

        // Initial defaultValue call happened once during init
        const countAfterInit = callCount

        // Wait long enough for exactly one revalidation cycle (50ms interval)
        await wait(75)

        // With the bug, each store starts its own interval so defaultValue
        // gets called twice per cycle. It should only be called once.
        const revalidationCalls = callCount - countAfterInit
        expect(revalidationCalls).toBe(1)

        // Both stores should have the updated value
        expect(store1.get(testAtom)).toBe(store2.get(testAtom))

        unsub1()
        unsub2()
    })

    test("notifies subscribers that re-read synchronously across multiple resets", async () => {
        const a = atom(() => Promise.resolve("x"), {
            global: true,
            name: "test-reset-repeat",
        })
        const s = store()

        let notifyCount = 0
        s.sub(a, () => {
            notifyCount++
            s.get(a) // synchronous re-read — what useSyncExternalStore does
        })

        await s.get(a)
        await wait(10)
        const base = notifyCount

        a.resetSelf()
        await wait(10)
        const afterFirst = notifyCount
        expect(afterFirst).toBeGreaterThan(base)

        a.resetSelf()
        await wait(10)
        const afterSecond = notifyCount
        expect(afterSecond).toBeGreaterThan(afterFirst)
    })

    test("preserves fresh onInit registration when propagation triggers re-init", () => {
        let registrationCount = 0
        let cleanupCount = 0
        const a = atom("initial", {
            global: true,
            name: "test-reset-oninit",
            onInit: () => {
                registrationCount++
                return () => {
                    cleanupCount++
                }
            },
        })
        const s = store()
        s.sub(a, () => {
            s.get(a)
        })
        s.get(a)

        const regBefore = registrationCount
        const cleanupBefore = cleanupCount
        a.resetSelf()

        expect(registrationCount - regBefore).toBe(1)
        expect(cleanupCount - cleanupBefore).toBe(1)
    })

    test("resetSelf rebuilds maxAge interval while subscribers remain", async () => {
        let callCount = 0
        const testAtom = atom(
            () => {
                callCount++
                return callCount
            },
            { global: true, maxAge: 50 },
        )

        const store1 = store()

        const unsub1 = store1.sub(testAtom, () => {
            store1.get(testAtom)
        })

        // Force initialization so the first defaultValue() call is counted.
        store1.get(testAtom)

        // Baseline: the interval fires once before reset.
        await wait(75)
        const countBeforeReset = callCount
        expect(countBeforeReset).toBeGreaterThanOrEqual(2)

        testAtom.resetSelf()

        const countAfterReset = callCount

        // After reset, the timer should be rebuilt for the still-subscribed
        // store so revalidation continues.
        await wait(75)

        expect(callCount).toBeGreaterThan(countAfterReset)

        unsub1()
    })

    test("resetSelf stops maxAge interval when no subscribers remain", async () => {
        let callCount = 0
        const testAtom = atom(
            () => {
                callCount++
                return callCount
            },
            { global: true, maxAge: 50 },
        )

        const store1 = store()
        store1.get(testAtom)

        testAtom.resetSelf()

        const countAfterReset = callCount
        await wait(75)

        expect(callCount).toBe(countAfterReset)
    })
})
