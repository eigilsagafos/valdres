import { selector, type Selector } from "valdres"
import type { GeolocationError } from "../types/GeolocationError"
import { geolocationAtom } from "./geolocationAtom"

export const geolocationErrorAtom: Selector<GeolocationError | null> = selector(
    get => get(geolocationAtom).error,
    { name: "@valdres/browser-geolocation/error" },
)
