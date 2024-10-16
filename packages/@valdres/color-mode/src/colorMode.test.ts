import { describe, test, expect, mock } from "bun:test"
import { store } from "valdres"
import { colorMode } from "./colorMode"
import { ColorMode } from "../types/ColorMode"

const mockWindow = () => {
    const eventListeners = new Set()
    let currentValue = true
    globalThis.window = {
        matchMedia: () => {
            return {
                matches: currentValue,
                addEventListener: (event, callback) => {
                    eventListeners.add(callback)
                },
                removeEventListener: (event, callback) => {
                    eventListeners.delete(callback)
                },
            }
        },
    }
    return {
        togglePrefersColorScheme: () => {
            currentValue = !currentValue
            // performance.now()
            const event = {
                matches: currentValue,
                media: "(prefers-color-scheme: dark)",
                type: "change",
                timeStamp: performance.now(),
            }
            for (const cb of eventListeners) {
                cb(event)
            }
        },
        cleanup: () => {},
        eventListeners,
    }
}

describe("is-dark-mode", () => {
    test("is good", () => {
        const { togglePrefersColorScheme, eventListeners } = mockWindow()
        const store1 = store()
        const subscription = mock(() => {})
        expect(eventListeners.size).toBe(0)
        expect(store1.get(colorMode)).toBe(ColorMode.Dark)
        expect(eventListeners.size).toBe(1)
        togglePrefersColorScheme()
        expect(store1.get(colorMode)).toBe(ColorMode.Light)

        store1.sub(colorMode, subscription)
        expect(subscription).toHaveBeenCalledTimes(0)
        togglePrefersColorScheme()
        expect(subscription).toHaveBeenCalledTimes(1)
        expect(store1.get(colorMode)).toBe(ColorMode.Dark)
        expect(eventListeners.size).toBe(1)
    })
})
