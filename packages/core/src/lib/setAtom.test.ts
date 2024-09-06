import { describe, test, expect, mock } from "bun:test"
import { createStore } from "../createStore"
import { atom } from "../atom"
import { setAtom } from "./setAtom"
import { selector } from "../selector"

describe("setAtom", () => {
    test("set with direct value", () => {
        const store = createStore()
        const numberAtom = atom(1)
        expect(store.data.values.get(numberAtom)).toBeUndefined()
        setAtom(numberAtom, 2, store.data)
        expect(store.data.values.get(numberAtom)).toBe(2)
    })

    test("set with callback", () => {
        const store = createStore()
        const numberAtom = atom(1)
        expect(store.data.values.get(numberAtom)).toBeUndefined()
        setAtom(numberAtom, (current) => current + 1, store.data)
        expect(store.data.values.get(numberAtom)).toBe(2)
    })

    test("set with same value does not trigger selectors and subscribers to re-evalute", () => {
        const store = createStore()
        const numberAtom = atom(1)
        const selectorCallback = mock((get) => get(numberAtom) + 1)
        const multiplySelector = selector(selectorCallback)
        expect(store.get(multiplySelector)).toBe(2)
        expect(selectorCallback).toHaveBeenCalledTimes(1)
        store.set(numberAtom, 1)
        expect(store.get(multiplySelector)).toBe(2)
        expect(selectorCallback).toHaveBeenCalledTimes(1)
    })
})
