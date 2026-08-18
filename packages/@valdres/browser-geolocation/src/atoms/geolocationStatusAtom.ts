import { globalAtom } from "valdres"
import type { GeolocationStatus } from "../types/GeolocationStatus"

const getInitial = (): GeolocationStatus => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
        return "unsupported"
    }
    return "idle"
}

export const geolocationStatusAtom = globalAtom<GeolocationStatus>(
    getInitial,
    { name: "@valdres/browser-geolocation/status" },
)
