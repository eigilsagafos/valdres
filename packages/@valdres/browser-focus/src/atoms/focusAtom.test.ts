import { describe, test, expect, afterAll } from "bun:test"
import { store } from "valdres"
import { focusAtom } from "./focusAtom"

const setHasFocus = (value: boolean) => {
    Object.defineProperty(document, "hasFocus", {
        value: () => value,
        configurable: true,
    })
}

describe("focusAtom", () => {
    afterAll(() => setHasFocus(true))

    test("first read evaluates lazily and onInit wires event listeners", () => {
        setHasFocus(false)
        const s = store()
        expect(s.get(focusAtom)).toBe(false)

        window.dispatchEvent(new Event("focus"))
        expect(s.get(focusAtom)).toBe(true)

        window.dispatchEvent(new Event("blur"))
        expect(s.get(focusAtom)).toBe(false)
    })
})
