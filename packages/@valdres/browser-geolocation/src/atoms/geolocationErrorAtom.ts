import { atom } from "valdres"
import type { GeolocationError } from "../types/GeolocationError"

export const geolocationErrorAtom = atom<GeolocationError | null>(null, {
    global: true,
    name: "@valdres/browser-geolocation/error",
})
