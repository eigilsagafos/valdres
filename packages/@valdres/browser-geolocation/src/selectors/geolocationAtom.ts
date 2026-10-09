import { selector, type Selector } from "valdres"
import { supportAtom } from "../atoms/supportAtom"
import { watchSessionAtom } from "../atoms/watchSessionAtom"
import type { GeolocationState } from "../types/GeolocationState"

/**
 * The store's coherent geolocation state: status, position and error from one
 * publication. Reading or subscribing never starts a watch and never prompts;
 * only `watchGeolocation` does.
 */
export const geolocationAtom: Selector<GeolocationState> = selector(
    get => {
        const session = get(watchSessionAtom)
        return session === null ? get(supportAtom) : get(session)
    },
    { name: "@valdres/browser-geolocation/state" },
)
