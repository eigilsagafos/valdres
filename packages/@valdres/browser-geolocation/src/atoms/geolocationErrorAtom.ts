import { globalAtom } from "valdres"
import type { GeolocationError } from "../types/GeolocationError"

export const geolocationErrorAtom = globalAtom<GeolocationError | null>(null, {
    name: "@valdres/browser-geolocation/error",
})
