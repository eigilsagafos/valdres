import { selector, type Selector } from "valdres"
import { positionAtom } from "./positionAtom"

export const altitudeSelector: Selector<number | null> = selector(
    get => get(positionAtom)?.altitude ?? null,
    { name: "@valdres/browser-geolocation/altitude" },
)
