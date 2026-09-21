import type { ExternalSource } from "valdres"
import type { ReducedTransparency } from "../types/ReducedTransparency"
import { mediaQuery } from "./mediaQuery"

export const REDUCED_TRANSPARENCY_MEDIA = "(prefers-reduced-transparency: reduce)"

/**
 * Reported when the preference cannot be observed — during server rendering and
 * in DOM-less or `matchMedia`-less runtimes. `no-preference` is what the media
 * query itself resolves to when the user has expressed no preference, so an
 * unobservable host reports the same thing as an unconfigured one.
 */
export const REDUCED_TRANSPARENCY_UNAVAILABLE: ReducedTransparency = "no-preference"

const read = (): ReducedTransparency => {
    const query = mediaQuery(REDUCED_TRANSPARENCY_MEDIA)
    if (query === undefined) return REDUCED_TRANSPARENCY_UNAVAILABLE
    return query.matches ? "reduce" : "no-preference"
}

export const reducedTransparencySource: ExternalSource<ReducedTransparency> = {
    getSnapshot: read,
    getServerSnapshot: () => REDUCED_TRANSPARENCY_UNAVAILABLE,
    subscribe: invalidate => {
        const query = mediaQuery(REDUCED_TRANSPARENCY_MEDIA)
        if (query === undefined) return () => {}
        query.addEventListener("change", invalidate)
        return () => query.removeEventListener("change", invalidate)
    },
}
