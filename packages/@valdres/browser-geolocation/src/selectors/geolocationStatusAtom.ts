import { selector, type Selector } from "valdres"
import type { GeolocationStatus } from "../types/GeolocationStatus"
import { geolocationAtom } from "./geolocationAtom"

export const geolocationStatusAtom: Selector<GeolocationStatus> = selector(
    get => get(geolocationAtom).status,
    { name: "@valdres/browser-geolocation/status" },
)
