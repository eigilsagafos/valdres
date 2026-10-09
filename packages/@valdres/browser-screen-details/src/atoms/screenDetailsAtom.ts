import { externalAtom, type ExternalAtom } from "valdres"
import { screenDetailsSource } from "../lib/screenDetailsSource"
import type { ScreenDetailsState } from "../types/ScreenDetailsState"

/**
 * The page's coherent screen-details state. Reading or subscribing never
 * prompts; only `requestScreenDetails()` does. Subscribing keeps the screens
 * current once access was granted.
 */
export const screenDetailsAtom: ExternalAtom<ScreenDetailsState> = externalAtom(
    screenDetailsSource,
    { name: "@valdres/browser-screen-details/details" },
)
