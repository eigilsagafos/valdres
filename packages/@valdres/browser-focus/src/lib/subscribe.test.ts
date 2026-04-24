import { describe, test, expect, afterEach } from "bun:test"
import { store } from "valdres"
import { subscribe } from "./subscribe"
import { focusAtom } from "../atoms/focusAtom"

const setHasFocus = (value: boolean) => {
    Object.defineProperty(document, "hasFocus", {
        value: () => value,
        configurable: true,
    })
}

describe("subscribe", () => {
    afterEach(() => setHasFocus(true))

    test("syncs initial value from document.hasFocus()", () => {
        setHasFocus(false)
        const s = store()
        const cleanup = subscribe()
        expect(s.get(focusAtom)).toBe(false)
        cleanup?.()
    })

    test("updates atom when focus/blur events fire", () => {
        setHasFocus(true)
        const s = store()
        const cleanup = subscribe()

        expect(s.get(focusAtom)).toBe(true)

        window.dispatchEvent(new Event("blur"))
        expect(s.get(focusAtom)).toBe(false)

        window.dispatchEvent(new Event("focus"))
        expect(s.get(focusAtom)).toBe(true)

        cleanup?.()
    })

    test("cleanup removes listeners so later events do not update atom", () => {
        setHasFocus(true)
        const s = store()
        const cleanup = subscribe()
        cleanup?.()

        window.dispatchEvent(new Event("blur"))
        expect(s.get(focusAtom)).toBe(true)
    })
})
