import { systemColorModeAtom } from "../src/systemColorModeAtom"
import { userSelectedColorModeAtom } from "../src/userSelectedColorModeAtom"

export const mockWindow = () => {
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
        reset: () => {
            currentValue = true
            systemColorModeAtom.resetSelf()
            userSelectedColorModeAtom.resetSelf()
        },
        eventListeners,
    }
}
