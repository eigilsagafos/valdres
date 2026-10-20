import { selector, type Selector } from "valdres"
import type { GeolocationSnapshot } from "../types/GeolocationSnapshot"
import { geolocationAtom } from "./geolocationAtom"

/** The latest position this store's watch reported, or `null`. */
export const positionAtom: Selector<GeolocationSnapshot | null> = selector(
    get => get(geolocationAtom).position,
    { name: "@valdres/browser-geolocation/position" },
)
