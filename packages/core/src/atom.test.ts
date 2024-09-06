import { describe, test, expect } from "bun:test"
import { atom } from "./atom"
import { selector } from "./selector"
import { createStore } from "./createStore"

describe("atom", () => {
    test("is good", () => {
        const store = createStore()
        const ageAtom = atom(24)
        const ageDoubleSelector = selector(get => get(ageAtom) * 2)

        store.set(ageAtom, 20)
        expect(store.get(ageAtom)).toBe(20)
        expect(store.get(ageDoubleSelector)).toBe(40)

        store.set(ageAtom, 30)
        expect(store.get(ageAtom)).toBe(30)
        expect(store.get(ageDoubleSelector)).toBe(60)
    })

    test("set with function", () => {
        const store = createStore()
        const numberAtom = atom(10)
        expect(store.get(numberAtom)).toBe(10)
        store.set(numberAtom, curr => curr * 10)
        expect(store.get(numberAtom)).toBe(100)
    })

    test("async default", () => {
        const store = createStore()
        const asyncFunction = () =>
            new Promise(resolve => setTimeout(() => resolve("done"), 100))
        const numberAtom = atom(asyncFunction)
        const res = store.get(numberAtom)
        console.log(res)
    })
})
