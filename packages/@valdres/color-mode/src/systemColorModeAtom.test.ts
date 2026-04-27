import { describe, test, expect, mock } from "bun:test"
import { store } from "valdres"
import { systemColorModeAtom } from "./systemColorModeAtom"
import { mockWindow } from "../test/mockWindow"

describe("systemColorModeAtom", () => {
    test("default", () => {
        const { togglePrefersColorScheme, eventListeners, reset } = mockWindow()
        const store1 = store()
        const subscription = mock(() => {})

        // Reads alone don't mount listeners — only subscriptions do.
        expect(eventListeners.size).toBe(0)
        expect(store1.get(systemColorModeAtom)).toBe("dark")
        expect(eventListeners.size).toBe(0)

        const unsub = store1.sub(systemColorModeAtom, subscription)
        expect(eventListeners.size).toBe(1)
        expect(subscription).toHaveBeenCalledTimes(0)

        togglePrefersColorScheme()
        expect(subscription).toHaveBeenCalledTimes(1)
        expect(store1.get(systemColorModeAtom)).toBe("light")

        togglePrefersColorScheme()
        expect(subscription).toHaveBeenCalledTimes(2)
        expect(store1.get(systemColorModeAtom)).toBe("dark")

        unsub()
        expect(eventListeners.size).toBe(0)
        reset()
    })
})
