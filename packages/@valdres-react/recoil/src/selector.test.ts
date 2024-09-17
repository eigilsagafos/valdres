import { describe, test, expect } from "bun:test"
import { atom as valdresAtom, createStore } from "valdres-react"
import { selector } from "./selector"

describe("recoil/selector", () => {
    test("simple", () => {
        const store = createStore()
        const selector1 = selector({
            key: "Foo",
            get: () => 1,
        })
        expect(store.get(selector1)).toBe(1)
    })

    test("with atom sub", () => {
        const store = createStore()
        const atom1 = valdresAtom(2)
        const selector1 = selector({
            key: "Foo",
            get: ({ get }) => get(atom1),
        })
        expect(store.get(selector1)).toBe(2)
    })

    test("nested selectors", () => {
        const store = createStore()
        const atom1 = valdresAtom(1)
        const selector1 = selector({
            key: "Selector1",
            get: ({ get }) => get(atom1) + 1,
        })
        const selector2 = selector({
            key: "Selector2",
            get: ({ get }) => get(selector1) + 1,
        })
        expect(store.get(selector2)).toBe(3)
    })

    test("set", () => {
        const store = createStore()
        const atom1 = valdresAtom(1)
        const atom2 = valdresAtom(2)
        const selector1 = selector({
            key: "Foo",
            get: ({ get }) => get(atom1) + get(atom2),
            set: ({ get, set }, arg) => {
                set(atom1, arg[0])
                set(atom2, arg[1])
            },
        })
        expect(store.get(selector1)).toBe(3)
        store.set(selector1, [3, 4])
        expect(store.get(selector1)).toBe(7)
    })
})
