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

    test("subscribing wires event listeners and reflects document focus", () => {
        setHasFocus(false)
        const s = store()
        const unsub = s.sub(focusAtom, () => {})
        expect(s.get(focusAtom)).toBe(false)

        window.dispatchEvent(new Event("focus"))
        expect(s.get(focusAtom)).toBe(true)

        window.dispatchEvent(new Event("blur"))
        expect(s.get(focusAtom)).toBe(false)
        unsub()
    })
})
