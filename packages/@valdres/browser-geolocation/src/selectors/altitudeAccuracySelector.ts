import { selector, type Selector } from "valdres"
import { positionAtom } from "./positionAtom"

export const altitudeAccuracySelector: Selector<number | null> = selector(
    get => get(positionAtom)?.altitudeAccuracy ?? null,
    { name: "@valdres/browser-geolocation/altitudeAccuracy" },
)
