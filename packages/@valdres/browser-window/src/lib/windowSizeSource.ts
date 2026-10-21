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

/** Animation frames after the last `resize` on which the size is measured
 *  again: the second and third, where Chromium was measured to catch up, and
 *  one more as margin. See `subscribe`. */
const FIRST_FOLLOW_UP_FRAME = 2
const LAST_FOLLOW_UP_FRAME = 4

const report = (failures: unknown[]): void => {
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1)
        throw new AggregateError(failures, "Window size delivery failed")
}

export const windowSizeSource: ExternalSource<WindowSize> = {
    getSnapshot: measure,
    getServerSnapshot: () => WINDOW_SIZE_UNAVAILABLE,
    subscribe: invalidate => {
        const win = observedWindow()
        if (win === undefined) return () => {}

        // Chromium (151, 154 and 155 on macOS, measured) dispatches `resize`
        // while `outerWidth` / `outerHeight` still report the previous window
        // bounds, and updates them without another event: never by the first
        // animation frame after the event, usually by the second, sometimes
        // only by the third. So every `resize` is measured at once and again
        // on frames FIRST..LAST after it. A re-measurement only invalidates:
        // an unchanged reading is the same snapshot and notifies nobody.
        // Each `resize` restarts the sequence, so a burst leaves one, counted
        // from the last event; `generation` turns any older callback that
        // still runs into a no-op. Nothing runs while frames are suspended
        // (a hidden tab); the sequence resumes with them.
        const frames =
            typeof win.requestAnimationFrame === "function" &&
            typeof win.cancelAnimationFrame === "function"
                ? win
                : undefined
        let generation = 0
        let pending: number | undefined
        const cancelFollowUp = () => {
            generation++
            if (pending !== undefined) frames?.cancelAnimationFrame(pending)
            pending = undefined
        }
        const scheduleFollowUp = () => {
            cancelFollowUp()
            if (frames === undefined) return
            const scheduled = generation
            let frame = 0
            const tick = () => {
                if (scheduled !== generation) return
                frame++
                // Queue the next frame first, so a subscriber that throws
                // cannot end the sequence early.
                pending =
                    frame < LAST_FOLLOW_UP_FRAME
                        ? frames.requestAnimationFrame(tick)
                        : undefined
                if (frame >= FIRST_FOLLOW_UP_FRAME) invalidate()
            }
            pending = frames.requestAnimationFrame(tick)
        }
        // Cleared by release. A host that failed to remove the listener may
        // still invoke it; it must then schedule nothing.
        let active = true
        const onResize = () => {
            if (!active) return
            const failures: unknown[] = []
            try {
                scheduleFollowUp()
            } catch (error) {
                failures.push(error)
            }
            try {
                invalidate()
            } catch (error) {
                failures.push(error)
            }
            report(failures)
        }

        // `resize` is the only event for either size: browsers fire it for
        // window resizes, zoom, rotation and mobile toolbar changes. Moving a
        // window without resizing it fires nothing, which is why the window's
        // position is not part of the snapshot.
        win.addEventListener("resize", onResize)
        return () => {
            active = false
            try {
                cancelFollowUp()
            } finally {
                win.removeEventListener("resize", onResize)
            }
        }
    },
}
