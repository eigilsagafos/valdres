import { selector, type Selector } from "valdres"
import { positionAtom } from "./positionAtom"

export const headingSelector: Selector<number | null> = selector(
    get => get(positionAtom)?.heading ?? null,
    { name: "@valdres/browser-geolocation/heading" },
)
