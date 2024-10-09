import { describe, test, expect } from "bun:test"
import { createStore } from "../createStore"
import { atom } from "../atom"

describe("globalAtom", () => {
    test("set in one store, read from both", () => {
        const store1 = createStore()
        const store2 = createStore()
        const numberAtom = atom<number>(0, { global: true })
        store1.set(numberAtom, 1)
        expect(store1.get(numberAtom)).toBe(1)
        expect(store2.get(numberAtom)).toBe(1)
    })

    test("set in txn", () => {
        const store1 = createStore()
        const store2 = createStore()
        const numberAtom = atom<number>(0, { global: true })
        store1.txn(set => {
            set(numberAtom, 1)
        })
        expect(store1.get(numberAtom)).toBe(1)
        expect(store2.get(numberAtom)).toBe(1)
    })
})
