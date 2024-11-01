import { describe, test, expect, mock } from "bun:test"
import { store } from "../store"
import { atom } from "../atom"

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
        store1.txn(set => {
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
        expect(() => testAtom.resetSelf()).toThrow()
    })

    test.todo("reset support for subscriptions etc.", () => {})
})
