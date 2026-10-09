import type { ExternalSource } from "valdres"
import type { WindowSize } from "../types/WindowSize"

/**
 * Reported when there is no window to measure — during server rendering and in
 * runtimes without a `window` (Node, Bun, Deno, workers). Zero is the
 * "unknown" answer: no real window has a zero-sized layout viewport while a
 * page is rendering in it, so it cannot be mistaken for a measurement.
 */
export const WINDOW_SIZE_UNAVAILABLE: WindowSize = Object.freeze({
    innerWidth: 0,
    innerHeight: 0,
    outerWidth: 0,
    outerHeight: 0,
})

/** Resolved on every call, never at import: importing reads no browser global. */
const observedWindow = (): Window | undefined => {
    if (typeof window === "undefined") return undefined
    if (typeof window.innerWidth !== "number") return undefined
    if (typeof window.addEventListener !== "function") return undefined
    return window
}

// The last snapshot handed out. Every store reads the same window, so they all
// share it: an unchanged measurement must come back as the very same object,
// because the core compares snapshots with Object.is. A fresh object per read
// would notify every subscriber on every `resize`, size changed or not.
let last: WindowSize = WINDOW_SIZE_UNAVAILABLE

const measure = (): WindowSize => {
    const win = observedWindow()
    if (win === undefined) return WINDOW_SIZE_UNAVAILABLE
    const { innerWidth, innerHeight, outerWidth, outerHeight } = win
    if (
        Object.is(innerWidth, last.innerWidth) &&
        Object.is(innerHeight, last.innerHeight) &&
        Object.is(outerWidth, last.outerWidth) &&
        Object.is(outerHeight, last.outerHeight)
    )
        return last
    last = Object.freeze({ innerWidth, innerHeight, outerWidth, outerHeight })
    return last
}

export const windowSizeSource: ExternalSource<WindowSize> = {
    getSnapshot: measure,
    getServerSnapshot: () => WINDOW_SIZE_UNAVAILABLE,
    subscribe: invalidate => {
        const win = observedWindow()
        if (win === undefined) return () => {}
        // `resize` is the only event for either size: browsers fire it for
        // window resizes, zoom, rotation and mobile toolbar changes. Moving a
        // window without resizing it fires nothing, which is why the window's
        // position is not part of the snapshot.
        win.addEventListener("resize", invalidate)
        return () => win.removeEventListener("resize", invalidate)
    },
}
