import type { ExternalSource } from "valdres"
import type { ColorScheme } from "../types/ColorScheme"
import { mediaQuery } from "./mediaQuery"

export const COLOR_SCHEME_MEDIA = "(prefers-color-scheme: dark)"

/**
 * Reported when the OS preference cannot be observed — during server rendering
 * and in DOM-less or `matchMedia`-less runtimes. `light` is the CSS default for
 * a document that has expressed no `color-scheme` preference, so a server render
 * seeded with it matches what an unstyled browser would paint.
 */
export const COLOR_SCHEME_UNAVAILABLE: ColorScheme = "light"

const read = (): ColorScheme => {
    const query = mediaQuery(COLOR_SCHEME_MEDIA)
    if (query === undefined) return COLOR_SCHEME_UNAVAILABLE
    return query.matches ? "dark" : "light"
}

export const colorSchemeSource: ExternalSource<ColorScheme> = {
    getSnapshot: read,
    getServerSnapshot: () => COLOR_SCHEME_UNAVAILABLE,
    subscribe: invalidate => {
        const query = mediaQuery(COLOR_SCHEME_MEDIA)
        if (query === undefined) return () => {}
        query.addEventListener("change", invalidate)
        return () => query.removeEventListener("change", invalidate)
    },
}
