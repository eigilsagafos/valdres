import type { ExternalSource } from "valdres"
import type { Contrast } from "../types/Contrast"
import { mediaQuery } from "./mediaQuery"

/**
 * `prefers-contrast` is four values behind three media queries, and a host can
 * report more than one as matching. The order here is the package's published
 * precedence — the first matching query wins — and is unchanged from the
 * pre-ExternalAtom implementation.
 */
export const CONTRAST_QUERIES: readonly { value: Contrast; query: string }[] = [
    { value: "more", query: "(prefers-contrast: more)" },
    { value: "less", query: "(prefers-contrast: less)" },
    { value: "custom", query: "(prefers-contrast: custom)" },
]

/**
 * Reported when the queries cannot be observed — during server rendering and in
 * DOM-less or `matchMedia`-less runtimes. `no-preference` is what the queries
 * themselves resolve to when the user has expressed no preference, so an
 * unobservable host reports the same thing as an unconfigured one.
 */
export const CONTRAST_UNAVAILABLE: Contrast = "no-preference"

const read = (): Contrast => {
    for (const { value, query } of CONTRAST_QUERIES) {
        if (mediaQuery(query)?.matches) return value
    }
    return CONTRAST_UNAVAILABLE
}

export const contrastSource: ExternalSource<Contrast> = {
    getSnapshot: read,
    getServerSnapshot: () => CONTRAST_UNAVAILABLE,
    subscribe: invalidate => {
        const attached: MediaQueryList[] = []
        const detach = () => {
            for (const query of attached)
                query.removeEventListener("change", invalidate)
            attached.length = 0
        }
        try {
            for (const { query } of CONTRAST_QUERIES) {
                const list = mediaQuery(query)
                if (list === undefined) continue
                list.addEventListener("change", invalidate)
                attached.push(list)
            }
        } catch (error) {
            // A partially attached source would report stale values forever and
            // leak the listeners it did install. Release them and let the core
            // surface the failure.
            detach()
            throw error
        }
        return detach
    },
}
