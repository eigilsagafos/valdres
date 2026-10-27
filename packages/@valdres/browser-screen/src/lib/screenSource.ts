import type { ExternalSource } from "valdres"
import type { ScreenInfo } from "../types/ScreenInfo"
import type { ScreenOrientationType } from "../types/ScreenOrientationType"

/**
 * Reported when there is no screen to read — during server rendering and in
 * runtimes without `window.screen` (Node, Bun, Deno, workers). Dimensions are
 * zero ("unknown"); depth, ratio and orientation are the values an unknown
 * desktop display most likely has.
 */
export const SCREEN_UNAVAILABLE: ScreenInfo = Object.freeze({
    width: 0,
    height: 0,
    availWidth: 0,
    availHeight: 0,
    colorDepth: 24,
    pixelDepth: 24,
    devicePixelRatio: 1,
    orientationType: "landscape-primary",
    orientationAngle: 0,
})

const ORIENTATION_TYPES: ReadonlySet<string> = new Set<ScreenOrientationType>([
    "portrait-primary",
    "portrait-secondary",
    "landscape-primary",
    "landscape-secondary",
])

interface ScreenHost {
    readonly win: Window
    readonly screen: Screen
}

/** Resolved on every call, never at import: importing reads no browser global. */
const observedHost = (): ScreenHost | undefined => {
    if (typeof window === "undefined") return undefined
    const screen = window.screen as Screen | undefined
    if (screen == null || typeof screen.width !== "number") return undefined
    if (typeof window.addEventListener !== "function") return undefined
    return { win: window, screen }
}

const isEventTarget = (value: unknown): value is EventTarget =>
    value != null &&
    typeof (value as EventTarget).addEventListener === "function" &&
    typeof (value as EventTarget).removeEventListener === "function"

// The last snapshot handed out. Every store reads the same screen, so they all
// share it: an unchanged reading must come back as the very same object,
// because the core compares snapshots with Object.is. Without it, every
// `resize` would notify every subscriber, screen changed or not.
let last: ScreenInfo = SCREEN_UNAVAILABLE

const read = (): ScreenInfo => {
    const host = observedHost()
    if (host === undefined) return SCREEN_UNAVAILABLE
    const { win, screen } = host
    const orientation = screen.orientation as ScreenOrientation | undefined
    const type = orientation?.type
    const next: ScreenInfo = {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelDepth: screen.pixelDepth,
        devicePixelRatio: win.devicePixelRatio,
        orientationType:
            typeof type === "string" && ORIENTATION_TYPES.has(type)
                ? (type as ScreenOrientationType)
                : SCREEN_UNAVAILABLE.orientationType,
        orientationAngle:
            typeof orientation?.angle === "number"
                ? orientation.angle
                : SCREEN_UNAVAILABLE.orientationAngle,
    }
    for (const key in next)
        if (
            !Object.is(
                next[key as keyof ScreenInfo],
                last[key as keyof ScreenInfo],
            )
        ) {
            last = Object.freeze(next)
            return last
        }
    return last
}

const settle = (failures: unknown[]): void => {
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1)
        throw new AggregateError(failures, "Several screen listeners failed")
}

export const screenSource: ExternalSource<ScreenInfo> = {
    getSnapshot: read,
    getServerSnapshot: () => SCREEN_UNAVAILABLE,
    subscribe: invalidate => {
        const host = observedHost()
        if (host === undefined) return () => {}
        const { win, screen } = host
        const releases: (() => void)[] = []
        const listen = (
            target: EventTarget,
            type: string,
            listener: () => void,
        ) => {
            target.addEventListener(type, listener)
            releases.push(() => target.removeEventListener(type, listener))
        }

        // `(resolution: Xdppx)` only changes when the ratio leaves X, so after
        // every change the watch moves to the new ratio. It moves before the
        // store is told, so a subscriber that throws, or that unsubscribes
        // from inside its callback, cannot leave it watching a stale ratio.
        let active = true
        let query: MediaQueryList | undefined
        const watchResolution = () => {
            if (typeof win.matchMedia !== "function") return
            const next = win.matchMedia(
                `(resolution: ${win.devicePixelRatio}dppx)`,
            )
            next.addEventListener("change", onResolution)
            const previous = query
            query = next
            previous?.removeEventListener("change", onResolution)
        }
        function onResolution() {
            if (!active) return
            const failures: unknown[] = []
            try {
                watchResolution()
            } catch (error) {
                failures.push(error)
            }
            try {
                invalidate()
            } catch (error) {
                failures.push(error)
            }
            settle(failures)
        }

        // Every listener is released even when one removal throws; the
        // failures are reported together afterwards.
        const release = () => {
            active = false
            const failures: unknown[] = []
            const current = query
            query = undefined
            for (const detach of [
                ...releases.splice(0).reverse(),
                () => current?.removeEventListener("change", onResolution),
            ]) {
                try {
                    detach()
                } catch (error) {
                    failures.push(error)
                }
            }
            settle(failures)
        }

        try {
            // Size and availability changes, and on most engines rotation.
            listen(win, "resize", invalidate)
            // Rotation, where the engine has Screen Orientation.
            if (isEventTarget(screen.orientation))
                listen(screen.orientation, "change", invalidate)
            // Chromium's Screen is an EventTarget whose `change` fires when
            // the window's screen changes without the window resizing.
            if (isEventTarget(screen)) listen(screen, "change", invalidate)
            // Pixel ratio: zoom and moving between displays of different density.
            watchResolution()
        } catch (error) {
            // A half-attached source would miss some kinds of change forever.
            // Release what was installed and let the core surface the error.
            try {
                release()
            } catch {
                // The attachment failure is the one worth reporting.
            }
            throw error
        }
        return release
    },
}
