import { describe, test, expect } from "bun:test"
import { createRoot } from "solid-js"
import { atom, store as createStore } from "valdres"
import { createSetAtom } from "./createSetAtom"

describe("createSetAtom", () => {
    test("returns a setter function", () => {
        const countAtom = atom(0)
        const storeInstance = createStore()
        createRoot(dispose => {
            const setCount = createSetAtom(countAtom, storeInstance)
            expect(storeInstance.get(countAtom)).toBe(0)
            setCount(10)
            expect(storeInstance.get(countAtom)).toBe(10)
            dispose()
        })
    })

    test("setter supports updater function", () => {
        const countAtom = atom(5)
        const storeInstance = createStore()
        createRoot(dispose => {
            const setCount = createSetAtom(countAtom, storeInstance)
            setCount((prev: number) => prev * 2)
            expect(storeInstance.get(countAtom)).toBe(10)
            dispose()
        })
    })
})
