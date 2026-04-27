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

    test("onMount fires once across stores when first subscriber attaches", () => {
        const store1 = store()
        const store2 = store()
        const onMount = mock(() => {})
        const testAtom = atom("foo", { global: true, onMount })

        expect(store1.get(testAtom)).toBe("foo")
        expect(store2.get(testAtom)).toBe("foo")
        expect(onMount).toHaveBeenCalledTimes(0)

        const unsub1 = store1.sub(testAtom, () => {})
        expect(onMount).toHaveBeenCalledTimes(1)

        const unsub2 = store2.sub(testAtom, () => {})
        expect(onMount).toHaveBeenCalledTimes(1)

        unsub1()
        unsub2()
    })

    test("onMount cleanup fires when last subscriber across stores detaches", () => {
        const store1 = store()
        const store2 = store()
        const cleanup = mock(() => {})
        const testAtom = atom("foo", {
            global: true,
            onMount: () => cleanup,
        })

        const unsub1 = store1.sub(testAtom, () => {})
        const unsub2 = store2.sub(testAtom, () => {})
        expect(cleanup).toHaveBeenCalledTimes(0)

        unsub1()
        expect(cleanup).toHaveBeenCalledTimes(0)

        unsub2()
        expect(cleanup).toHaveBeenCalledTimes(1)
    })

    test("onMount re-fires after full unmount and re-subscribe", () => {
        const store1 = store()
        const onMount = mock(() => () => {})
        const testAtom = atom("foo", { global: true, onMount })

        const unsub1 = store1.sub(testAtom, () => {})
        expect(onMount).toHaveBeenCalledTimes(1)
        unsub1()

        const unsub2 = store1.sub(testAtom, () => {})
        expect(onMount).toHaveBeenCalledTimes(2)
        unsub2()
    })

    test("reset global atom restores default across stores", () => {
        const store1 = store()
        const store2 = store()
        const testAtom = atom("foo", { global: true })
        expect(store1.get(testAtom)).toBe("foo")
        expect(store2.get(testAtom)).toBe("foo")
        testAtom.setSelf("set self")
        expect(store1.get(testAtom)).toBe("set self")
        expect(store2.get(testAtom)).toBe("set self")
        testAtom.resetSelf()
        expect(store1.get(testAtom)).toBe("foo")
        expect(store2.get(testAtom)).toBe("foo")
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

    test("onMount cleanup fires exactly once when last subscriber across stores unsubs", () => {
        const store1 = store()
        const store2 = store()
        const store3 = store()
        const cleanup = mock(() => {})
        const testAtom = atom("foo", {
            global: true,
            onMount: () => cleanup,
        })
        const u1 = store1.sub(testAtom, () => {})
        const u2 = store2.sub(testAtom, () => {})
        const u3 = store3.sub(testAtom, () => {})
        u1()
        u2()
        expect(cleanup).toHaveBeenCalledTimes(0)
        u3()
        expect(cleanup).toHaveBeenCalledTimes(1)
    })

    test("resetSelf still clears value and remounts when cleanup throws", () => {
        let mountCalls = 0
        const a = atom("foo", {
            global: true,
            name: "test/reset-cleanup-throws",
            onMount: () => {
                mountCalls++
                return () => {
                    throw new Error("cleanup boom")
                }
            },
        })
        const s = store()
        const unsub = s.sub(a, () => {})
        expect(mountCalls).toBe(1)

        a.setSelf("changed")
        expect(s.get(a)).toBe("changed")

        let caught: unknown
        try {
            a.resetSelf()
        } catch (e) {
            caught = e
        }

        expect((caught as Error)?.message).toBe("cleanup boom")
        // Value reset went through despite the throwing cleanup.
        expect(s.get(a)).toBe("foo")
        // Active subscriber triggered a remount.
        expect(mountCalls).toBe(2)
        try {
            unsub()
        } catch {
            // The remount installed another throwing cleanup;
            // the unsub firing it is incidental to this test.
        }
    })

    test("resetSelf remounts atom when only a dependent selector is subscribed", () => {
        let mountCalls = 0
        let unmountCalls = 0
        const a = atom("foo", {
            global: true,
            name: "test/reset-transitive-sub",
            onMount: () => {
                mountCalls++
                return () => {
                    unmountCalls++
                }
            },
        })
        const sel = selector(get => get(a))
        const s = store()
        const unsub = s.sub(sel, () => {})

        // Selector subscribed → atom transitively mounted.
        expect(mountCalls).toBe(1)
        expect(unmountCalls).toBe(0)

        a.resetSelf()

        // Selector is still subscribed; atom should be remounted so listeners
        // installed by onMount keep tracking external state.
        expect(unmountCalls).toBe(1)
        expect(mountCalls).toBe(2)

        unsub()
        expect(unmountCalls).toBe(2)
    })

    test("onMount throw rolls back the global mount counter", () => {
        let calls = 0
        let shouldThrow = true
        const a = atom("foo", {
            global: true,
            name: "test/onmount-throws-rollback",
            onMount: () => {
                calls++
                if (shouldThrow) {
                    throw new Error("first mount fails")
                }
                return () => {}
            },
        })

        // First sub: userOnMount throws. mountAtom rethrows.
        const s1 = store()
        let firstThrow: unknown
        try {
            s1.sub(a, () => {})
        } catch (e) {
            firstThrow = e
        }
        expect((firstThrow as Error)?.message).toBe("first mount fails")
        expect(calls).toBe(1)

        // A fresh sub on a different store should re-fire userOnMount —
        // a stuck mountCount would leave it >0 and skip the user hook.
        shouldThrow = false
        const s2 = store()
        const unsub = s2.sub(a, () => {})
        expect(calls).toBe(2)
        unsub()
    })

    test("after resetSelf, globalStore is re-added to stores on next interaction", () => {
        const a = atom("foo", { global: true, name: "test/reset-globalStore-readd" })
        const s1 = store()
        const s2 = store()

        s1.get(a)
        s2.get(a)
        const storesBeforeReset = a.stores.size
        expect(storesBeforeReset).toBeGreaterThanOrEqual(3) // s1, s2, globalStore

        a.resetSelf()
        // No subscribers, so atom.stores collapses on reset.
        expect(a.stores.size).toBe(0)

        // First interaction (set from a fresh store) must re-establish
        // globalStore in atom.stores so cross-store sync works.
        const s3 = store()
        s3.set(a, "synced")
        expect(s3.get(a)).toBe("synced")
        // Cross-store sync: another store reading should observe the value.
        expect(s2.get(a)).toBe("synced")
        // globalStore must be back in atom.stores.
        const storesAfter = a.stores.size
        expect(storesAfter).toBeGreaterThanOrEqual(2) // s3 + globalStore at minimum
    })

    test("resetSelf does not install maxAge timer for atoms with only transitive subs", async () => {
        let callCount = 0
        const a = atom<number>(
            () => {
                callCount++
                return callCount
            },
            {
                global: true,
                name: "test/reset-maxage-transitive-only",
                maxAge: 30,
            },
        )
        const sel = selector(get => get(a))
        const s = store()
        s.sub(sel, () => {})

        // Selector subscribed but the atom has no direct subscribers,
        // so no maxAge timer should be installed before or after reset.
        expect(a.maxAgeInterval).toBeUndefined()

        a.resetSelf()

        // After reset, still no direct sub on the atom — no timer.
        expect(a.maxAgeInterval).toBeUndefined()
    })

    test("get on unmounted atom past maxAge re-runs defaultValue (lazy revalidation)", async () => {
        let calls = 0
        const a = atom<number>(
            () => {
                calls++
                return calls
            },
            {
                global: true,
                name: "test/lazy-revalidate-on-stale-get",
                maxAge: 50,
            },
        )
        const s = store()
        const initial = s.get(a)
        const callsAfterInit = calls

        // Re-read inside the freshness window: cached, no re-eval.
        expect(s.get(a)).toBe(initial)
        expect(calls).toBe(callsAfterInit)

        await wait(75) // past maxAge

        // Lazy revalidation: cache is stale; reading should re-run
        // defaultValue and surface a newer value.
        const fresh = s.get(a)
        expect(calls).toBeGreaterThan(callsAfterInit)
        expect(fresh).not.toBe(initial)
    })

    test("get within maxAge window returns cached value without re-eval", async () => {
        let calls = 0
        const a = atom<number>(
            () => {
                calls++
                return calls
            },
            {
                global: true,
                name: "test/lazy-revalidate-fresh-cache",
                maxAge: 200,
            },
        )
        const s = store()
        const initial = s.get(a)
        const callsAfterInit = calls

        await wait(20) // well within maxAge

        expect(s.get(a)).toBe(initial)
        expect(calls).toBe(callsAfterInit)
    })

    test("global onMount receives (store, state) args like non-global atoms", () => {
        let receivedStore: unknown = null
        let receivedState: unknown = null
        const a = atom("foo", {
            global: true,
            name: "test/onMount-args",
            onMount: (store, state) => {
                receivedStore = store
                receivedState = state
                return () => {}
            },
        })
        const s = store()
        const unsub = s.sub(a, () => {})
        expect(receivedStore).not.toBeNull()
        expect(receivedState).toBe(a)
        unsub()
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

    test("resetSelf cycles mount lifecycle for stores with active subscribers", () => {
        let mountCount = 0
        let unmountCount = 0
        const a = atom("initial", {
            global: true,
            name: "test-reset-mount-lifecycle",
            onMount: () => {
                mountCount++
                return () => {
                    unmountCount++
                }
            },
        })
        const s = store()
        const unsub = s.sub(a, () => {})
        expect(mountCount).toBe(1)
        expect(unmountCount).toBe(0)

        a.resetSelf()

        // resetSelf is a "full restart": cleanup runs, then onMount re-fires
        // for any subscribers that survived the reset.
        expect(unmountCount).toBe(1)
        expect(mountCount).toBe(2)

        unsub()
        expect(unmountCount).toBe(2)
    })

    test("resetSelf without subscribers does not invoke onMount", () => {
        let mountCount = 0
        const a = atom("initial", {
            global: true,
            name: "test-reset-no-subs",
            onMount: () => {
                mountCount++
                return () => {}
            },
        })
        const s = store()
        s.get(a)
        expect(mountCount).toBe(0)
        a.resetSelf()
        expect(mountCount).toBe(0)
    })

    test("setSelf with bare promise resolves into stored value across stores", async () => {
        const store1 = store()
        const store2 = store()
        const testAtom = atom<string | Promise<string>>("initial", {
            global: true,
            name: "bare-promise-resolve",
        })
        expect(store1.get(testAtom)).toBe("initial")
        expect(store2.get(testAtom)).toBe("initial")

        const sub1 = mock(() => {})
        const sub2 = mock(() => {})
        store1.sub(testAtom, sub1)
        store2.sub(testAtom, sub2)

        testAtom.setSelf(Promise.resolve("new"))
        await wait(0)

        expect(store1.get(testAtom)).toBe("new")
        expect(store2.get(testAtom)).toBe("new")
        expect(sub1).toHaveBeenCalled()
        expect(sub2).toHaveBeenCalled()
    })

    test("setSelf with bare rejected promise reverts to previous value", async () => {
        const store1 = store()
        const store2 = store()
        const testAtom = atom<string | Promise<string>>("previous", {
            global: true,
            name: "bare-promise-reject",
        })
        expect(store1.get(testAtom)).toBe("previous")
        expect(store2.get(testAtom)).toBe("previous")

        testAtom.setSelf(Promise.reject(new Error("boom")))
        await wait(0)
        await Promise.resolve()

        expect(store1.get(testAtom)).toBe("previous")
        expect(store2.get(testAtom)).toBe("previous")
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

    test("resetSelf revives maxAge for passive subscribers that don't re-read", async () => {
        let defaultValueCalls = 0
        const testAtom = atom(
            () => {
                defaultValueCalls++
                return defaultValueCalls
            },
            { global: true, maxAge: 50 },
        )

        const store1 = store()
        let callbackCalls = 0
        const unsub = store1.sub(testAtom, () => {
            callbackCalls++
        })
        store1.get(testAtom)

        testAtom.resetSelf()

        const callbackCallsAfterReset = callbackCalls
        await wait(75)

        // Timer should fire and notify the subscriber even though its
        // callback never re-reads (so onInit isn't re-run via sync read).
        expect(callbackCalls).toBeGreaterThan(callbackCallsAfterReset)

        unsub()
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
