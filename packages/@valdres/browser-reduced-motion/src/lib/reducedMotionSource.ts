import type { ExternalSource } from "valdres"
import type { ReducedMotion } from "../types/ReducedMotion"
import { mediaQuery } from "./mediaQuery"

export const REDUCED_MOTION_MEDIA = "(prefers-reduced-motion: reduce)"

/**
 * Reported when the preference cannot be observed — during server rendering and
 * in DOM-less or `matchMedia`-less runtimes. `no-preference` is what the media
 * query itself resolves to when the user has expressed no preference, so an
 * unobservable host reports the same thing as an unconfigured one.
 */
export const REDUCED_MOTION_UNAVAILABLE: ReducedMotion = "no-preference"

const read = (): ReducedMotion => {
    const query = mediaQuery(REDUCED_MOTION_MEDIA)
    if (query === undefined) return REDUCED_MOTION_UNAVAILABLE
    return query.matches ? "reduce" : "no-preference"
}

export const reducedMotionSource: ExternalSource<ReducedMotion> = {
    getSnapshot: read,
    getServerSnapshot: () => REDUCED_MOTION_UNAVAILABLE,
    subscribe: invalidate => {
        const query = mediaQuery(REDUCED_MOTION_MEDIA)
        if (query === undefined) return () => {}
        query.addEventListener("change", invalidate)
        return () => query.removeEventListener("change", invalidate)
    },
}
