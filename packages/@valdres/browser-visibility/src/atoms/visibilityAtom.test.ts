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

    test("subscribing wires event listeners and reflects document visibility", () => {
        setVisibility("hidden")
        const s = store()
        const unsub = s.sub(visibilityAtom, () => {})
        expect(s.get(visibilityAtom)).toBe("hidden")

        setVisibility("visible")
        document.dispatchEvent(new Event("visibilitychange"))
        expect(s.get(visibilityAtom)).toBe("visible")

        setVisibility("hidden")
        document.dispatchEvent(new Event("visibilitychange"))
        expect(s.get(visibilityAtom)).toBe("hidden")
        unsub()
    })
})
