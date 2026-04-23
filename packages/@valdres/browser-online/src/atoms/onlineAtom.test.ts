import { describe, test, expect, afterAll } from "bun:test"
import { store } from "valdres"
import { onlineAtom } from "./onlineAtom"

const setOnLine = (value: boolean) => {
    Object.defineProperty(navigator, "onLine", {
        value,
        configurable: true,
    })
}

describe("onlineAtom", () => {
    afterAll(() => setOnLine(true))

    test("first read evaluates lazily and onInit wires event listeners", () => {
        setOnLine(false)
        const s = store()
        expect(s.get(onlineAtom)).toBe(false)

        setOnLine(true)
        window.dispatchEvent(new Event("online"))
        expect(s.get(onlineAtom)).toBe(true)

        setOnLine(false)
        window.dispatchEvent(new Event("offline"))
        expect(s.get(onlineAtom)).toBe(false)
    })
})
