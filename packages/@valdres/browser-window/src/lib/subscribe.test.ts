import { describe, expect, test } from "bun:test"
import { store } from "valdres"
import { windowSizeAtom } from "../atoms/windowSizeAtom"
import { subscribe } from "./subscribe"

describe("subscribe", () => {
    test("cleanup removes the resize listener", () => {
        const s = store()
        const cleanup = subscribe()

        Object.defineProperty(window, "innerWidth", {
            value: 1000,
            configurable: true,
        })
        window.dispatchEvent(new Event("resize"))
        expect(s.get(windowSizeAtom).innerWidth).toBe(1000)

        cleanup?.()

        Object.defineProperty(window, "innerWidth", {
            value: 2000,
            configurable: true,
        })
        window.dispatchEvent(new Event("resize"))
        expect(s.get(windowSizeAtom).innerWidth).toBe(1000)
    })
})
