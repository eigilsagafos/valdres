import { atom } from "valdres"
import type { GeolocationStatus } from "../../types/GeolocationStatus"

const getInitial = (): GeolocationStatus => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
        return "unsupported"
    }
    return "idle"
}

export const geolocationStatusAtom = atom<GeolocationStatus>(getInitial, {
    global: true,
    name: "@valdres/browser-geolocation/status",
})
