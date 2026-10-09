import { selector, type Selector } from "valdres"
import { orientationAtom } from "./orientationAtom"

export const betaSelector: Selector<number | null> = selector(
    get => get(orientationAtom)?.beta ?? null,
    { name: "@valdres/browser-device-orientation/beta" },
)
