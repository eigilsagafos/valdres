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

    test("subscribing wires event listeners and reflects navigator state", () => {
        setOnLine(false)
        const s = store()
        const unsub = s.sub(onlineAtom, () => {})
        expect(s.get(onlineAtom)).toBe(false)

        setOnLine(true)
        window.dispatchEvent(new Event("online"))
        expect(s.get(onlineAtom)).toBe(true)

        setOnLine(false)
        window.dispatchEvent(new Event("offline"))
        expect(s.get(onlineAtom)).toBe(false)
        unsub()
    })
})
