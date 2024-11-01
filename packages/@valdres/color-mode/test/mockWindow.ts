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
export const mockWindow = () => {
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
