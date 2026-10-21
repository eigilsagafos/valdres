import { externalAtom, type ExternalAtom } from "valdres"
import { supportSource } from "../lib/supportSource"
import type { GeolocationState } from "../types/GeolocationState"

/** Internal: the idle, unsupported or insecure state of a store with no watch. */
export const supportAtom: ExternalAtom<GeolocationState> = externalAtom(
    supportSource,
    { name: "@valdres/browser-geolocation/support" },
)
