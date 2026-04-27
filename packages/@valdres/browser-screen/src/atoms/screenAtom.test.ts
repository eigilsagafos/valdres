import { beforeEach, describe, expect, test } from "bun:test"
import { store } from "valdres"
import { screenAtom } from "./screenAtom"

describe("screenAtom", () => {
    // The atom is global; other test files exercising window-state mocks
    // can leave a stale cached value. Reset so each test starts clean.
    beforeEach(() => screenAtom.resetSelf())

    test("initial value reflects window.screen", () => {
        const s = store()
        const info = s.get(screenAtom)
        expect(info.width).toBe(window.screen.width)
        expect(info.height).toBe(window.screen.height)
        expect(info.devicePixelRatio).toBe(window.devicePixelRatio)
    })

    test("updates atom when window resize fires", () => {
        const s = store()
        const unsub = s.sub(screenAtom, () => {})

        Object.defineProperty(window.screen, "width", {
            value: 3840,
            configurable: true,
        })
        Object.defineProperty(window.screen, "height", {
            value: 2160,
            configurable: true,
        })
        window.dispatchEvent(new Event("resize"))

        const info = s.get(screenAtom)
        expect(info.width).toBe(3840)
        expect(info.height).toBe(2160)
        unsub()
    })
})
