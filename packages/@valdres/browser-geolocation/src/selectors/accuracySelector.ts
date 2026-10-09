import { selector, type Selector } from "valdres"
import { positionAtom } from "./positionAtom"

export const accuracySelector: Selector<number | null> = selector(
    get => get(positionAtom)?.accuracy ?? null,
    { name: "@valdres/browser-geolocation/accuracy" },
)
