import { describe, test, expect, afterEach } from "bun:test"
import { store } from "valdres"
import { subscribe } from "./subscribe"
import { onlineAtom } from "../atoms/onlineAtom"

const setOnLine = (value: boolean) => {
    Object.defineProperty(navigator, "onLine", {
        value,
        configurable: true,
    })
}

describe("subscribe", () => {
    afterEach(() => setOnLine(true))

    test("syncs initial value from navigator.onLine", () => {
        setOnLine(false)
        const s = store()
        const cleanup = subscribe()
        expect(s.get(onlineAtom)).toBe(false)
        cleanup?.()
    })

    test("updates atom when online/offline events fire", () => {
        setOnLine(true)
        const s = store()
        const cleanup = subscribe()

        expect(s.get(onlineAtom)).toBe(true)

        setOnLine(false)
        window.dispatchEvent(new Event("offline"))
        expect(s.get(onlineAtom)).toBe(false)

        setOnLine(true)
        window.dispatchEvent(new Event("online"))
        expect(s.get(onlineAtom)).toBe(true)

        cleanup?.()
    })

    test("cleanup removes listeners so later events do not update atom", () => {
        setOnLine(true)
        const s = store()
        const cleanup = subscribe()
        cleanup?.()

        setOnLine(false)
        window.dispatchEvent(new Event("offline"))
        expect(s.get(onlineAtom)).toBe(true)
    })
})
