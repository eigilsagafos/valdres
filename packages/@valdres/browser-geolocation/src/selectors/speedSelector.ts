import { selector, type Selector } from "valdres"
import { positionAtom } from "./positionAtom"

export const speedSelector: Selector<number | null> = selector(
    get => get(positionAtom)?.speed ?? null,
    { name: "@valdres/browser-geolocation/speed" },
)
