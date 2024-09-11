import { describe, test, expect } from "bun:test"
import { createStore } from "./createStore"
import { atom } from "./atom"
import { selector } from "./selector"

describe("createStore", () => {
    test("txn", () => {
        const store = createStore()
        const atom1 = atom(10)
        const atom2 = atom(5)
        // const res = store.get(atom(5))
        const selector1 = selector(get => {
            return get(atom1) * get(atom2)
        })
        expect(store.get(selector1)).toBe(50)

        store.txn((set, get) => {
            set(atom1, 11)
            set(atom2, 4)
            expect(get(atom1)).toBe(11)
        })
        expect(store.get(selector1)).toBe(44)
    })
})
