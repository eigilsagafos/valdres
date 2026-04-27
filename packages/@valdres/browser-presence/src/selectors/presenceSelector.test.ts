import { describe, test, expect, afterAll } from "bun:test"
import { store } from "valdres"
import { presenceSelector } from "./presenceSelector"

const setHasFocus = (value: boolean) => {
    Object.defineProperty(document, "hasFocus", {
        value: () => value,
        configurable: true,
    })
}

const setVisibility = (value: DocumentVisibilityState) => {
    Object.defineProperty(document, "visibilityState", {
        value,
        configurable: true,
    })
}

describe("presenceSelector", () => {
    afterAll(() => {
        setHasFocus(true)
        setVisibility("visible")
    })

    test("is true when tab is visible and window is focused", () => {
        setHasFocus(true)
        setVisibility("visible")
        const s = store()
        expect(s.get(presenceSelector)).toBe(true)
    })

    test("is false when window loses focus", () => {
        setHasFocus(true)
        setVisibility("visible")
        const s = store()
        const unsub = s.sub(presenceSelector, () => {})
        expect(s.get(presenceSelector)).toBe(true)

        window.dispatchEvent(new Event("blur"))
        expect(s.get(presenceSelector)).toBe(false)

        window.dispatchEvent(new Event("focus"))
        expect(s.get(presenceSelector)).toBe(true)
        unsub()
    })

    test("is false when tab becomes hidden", () => {
        setHasFocus(true)
        setVisibility("visible")
        const s = store()
        const unsub = s.sub(presenceSelector, () => {})
        expect(s.get(presenceSelector)).toBe(true)

        setVisibility("hidden")
        document.dispatchEvent(new Event("visibilitychange"))
        expect(s.get(presenceSelector)).toBe(false)

        setVisibility("visible")
        document.dispatchEvent(new Event("visibilitychange"))
        expect(s.get(presenceSelector)).toBe(true)
        unsub()
    })

    test("is false when both visibility and focus are lost", () => {
        setHasFocus(true)
        setVisibility("visible")
        const s = store()
        const unsub = s.sub(presenceSelector, () => {})
        expect(s.get(presenceSelector)).toBe(true)

        window.dispatchEvent(new Event("blur"))
        setVisibility("hidden")
        document.dispatchEvent(new Event("visibilitychange"))
        expect(s.get(presenceSelector)).toBe(false)

        window.dispatchEvent(new Event("focus"))
        expect(s.get(presenceSelector)).toBe(false)

        setVisibility("visible")
        document.dispatchEvent(new Event("visibilitychange"))
        expect(s.get(presenceSelector)).toBe(true)
        unsub()
    })
})
