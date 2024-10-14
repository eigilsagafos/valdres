import { describe, test, expect } from "bun:test"
import { createStore } from "../createStore"
import { atom } from "../atom"

describe("globalAtom", () => {
    test("set in one store, read from both", () => {
        const store1 = createStore()
        const store2 = createStore()
        const numberAtom = atom(0, { global: true })
        store1.set(numberAtom, 1)
        expect(store1.get(numberAtom)).toBe(1)
        expect(store2.get(numberAtom)).toBe(1)
    })

    test("set in txn", () => {
        const store1 = createStore()
        const store2 = createStore()
        const numberAtom = atom(0, { global: true })
        store1.txn(set => {
            set(numberAtom, 1)
        })
        expect(store1.get(numberAtom)).toBe(1)
        expect(store2.get(numberAtom)).toBe(1)
    })

    test("setSelf", () => {
        const store1 = createStore()
        const store2 = createStore()
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
})
