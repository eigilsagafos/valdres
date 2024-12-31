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
        const testAtom = atom(3, { global: true })
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
})
