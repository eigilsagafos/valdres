import { describe, test, expect, mock } from "bun:test"
import { store } from "valdres"
import { systemColorModeAtom } from "./systemColorModeAtom"
// import { ColorMode } from "../types/UserSelectedColorMode"
import { mockWindow } from "../test/mockWindow"

describe("is-dark-mode", () => {
    test("is good", () => {
        const { togglePrefersColorScheme, eventListeners } = mockWindow()
        const store1 = store()
        const subscription = mock(() => {})
        expect(eventListeners.size).toBe(0)
        expect(store1.get(systemColorModeAtom)).toBe("dark")
        expect(eventListeners.size).toBe(1)
        togglePrefersColorScheme()
        expect(store1.get(systemColorModeAtom)).toBe("light")

        store1.sub(systemColorModeAtom, subscription)
        expect(subscription).toHaveBeenCalledTimes(0)
        togglePrefersColorScheme()
        expect(subscription).toHaveBeenCalledTimes(1)
        expect(store1.get(systemColorModeAtom)).toBe("dark")
        expect(eventListeners.size).toBe(1)
    })
})
