import { describe, test, expect } from "bun:test"
import { createRoot } from "solid-js"
import { atom, store as createStore } from "valdres"
import { createResetAtom } from "./createResetAtom"

describe("createResetAtom", () => {
    test("resets atom to default value", () => {
        const countAtom = atom(0)
        const storeInstance = createStore()
        storeInstance.set(countAtom, 42)
        createRoot(dispose => {
            const reset = createResetAtom(countAtom, storeInstance)
            expect(storeInstance.get(countAtom)).toBe(42)
            reset()
            expect(storeInstance.get(countAtom)).toBe(0)
            dispose()
        })
    })
})
