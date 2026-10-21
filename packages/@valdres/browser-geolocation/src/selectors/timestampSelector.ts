import { selector, type Selector } from "valdres"
import { positionAtom } from "./positionAtom"

export const timestampSelector: Selector<number | null> = selector(
    get => get(positionAtom)?.timestamp ?? null,
    { name: "@valdres/browser-geolocation/timestamp" },
)
