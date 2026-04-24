import { describe, test, expect, afterAll } from "bun:test"
import { store } from "valdres"
import { visibilityAtom } from "./visibilityAtom"

const setVisibility = (value: DocumentVisibilityState) => {
    Object.defineProperty(document, "visibilityState", {
        value,
        configurable: true,
    })
}

describe("visibilityAtom", () => {
    afterAll(() => setVisibility("visible"))

    test("first read evaluates lazily and onInit wires event listeners", () => {
        setVisibility("hidden")
        const s = store()
        expect(s.get(visibilityAtom)).toBe("hidden")

        setVisibility("visible")
        document.dispatchEvent(new Event("visibilitychange"))
        expect(s.get(visibilityAtom)).toBe("visible")

        setVisibility("hidden")
        document.dispatchEvent(new Event("visibilitychange"))
        expect(s.get(visibilityAtom)).toBe("hidden")
    })
})
