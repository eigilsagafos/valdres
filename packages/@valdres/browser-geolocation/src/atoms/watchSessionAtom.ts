import { atom, type Atom, type ExternalAtom } from "valdres"
import type { GeolocationState } from "../types/GeolocationState"

/**
 * Internal: the watch session a store reads. Written only by
 * `watchGeolocation` on the exact store it was given, so a child scope
 * inherits its parent's session until it starts its own, and re-inherits it
 * when its own is released.
 */
export const watchSessionAtom: Atom<ExternalAtom<GeolocationState> | null> =
    atom<ExternalAtom<GeolocationState> | null>(null, {
        name: "@valdres/browser-geolocation/session",
    })
