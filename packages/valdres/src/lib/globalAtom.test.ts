import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"
import { selector } from "../selector"

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
})
