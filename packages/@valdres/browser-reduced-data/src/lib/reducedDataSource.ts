import type { ExternalSource } from "valdres"
import type { ReducedData } from "../types/ReducedData"
import { mediaQuery } from "./mediaQuery"

export const REDUCED_DATA_MEDIA = "(prefers-reduced-data: reduce)"

/**
 * Reported when the preference cannot be observed — during server rendering and
 * in DOM-less or `matchMedia`-less runtimes. `no-preference` is what the media
 * query itself resolves to when the user has expressed no preference, so an
 * unobservable host reports the same thing as an unconfigured one.
 */
export const REDUCED_DATA_UNAVAILABLE: ReducedData = "no-preference"

const read = (): ReducedData => {
    const query = mediaQuery(REDUCED_DATA_MEDIA)
    if (query === undefined) return REDUCED_DATA_UNAVAILABLE
    return query.matches ? "reduce" : "no-preference"
}

export const reducedDataSource: ExternalSource<ReducedData> = {
    getSnapshot: read,
    getServerSnapshot: () => REDUCED_DATA_UNAVAILABLE,
    subscribe: invalidate => {
        const query = mediaQuery(REDUCED_DATA_MEDIA)
        if (query === undefined) return () => {}
        query.addEventListener("change", invalidate)
        return () => query.removeEventListener("change", invalidate)
    },
}
