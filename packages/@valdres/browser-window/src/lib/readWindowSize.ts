import type { WindowSize } from "../types/WindowSize"

const EMPTY: WindowSize = Object.freeze({
    innerWidth: 0,
    innerHeight: 0,
    outerWidth: 0,
    outerHeight: 0,
})

export const readWindowSize = (): WindowSize => {
    if (typeof window === "undefined") return EMPTY
    return {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        outerWidth: window.outerWidth,
        outerHeight: window.outerHeight,
    }
}
