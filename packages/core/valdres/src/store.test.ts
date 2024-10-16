import { describe, test, expect } from "bun:test"
import { store } from "./store"
import { atom } from "./atom"
import { selector } from "./selector"

describe("store", () => {
    test("txn", () => {
        const store1 = store()
        const atom1 = atom(10)
        const atom2 = atom(5)
        // const res = store.get(atom(5))
        const selector1 = selector(get => {
            return get(atom1) * get(atom2)
        })
        expect(store1.get(selector1)).toBe(50)

        store1.txn((set, get) => {
            set(atom1, 11)
            set(atom2, 4)
            expect(get(atom1)).toBe(11)
        })
        expect(store1.get(selector1)).toBe(44)
    })
})
