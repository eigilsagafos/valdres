import { selector, type Selector } from "valdres"
import { orientationAtom } from "./orientationAtom"

export const gammaSelector: Selector<number | null> = selector(
    get => get(orientationAtom)?.gamma ?? null,
    { name: "@valdres/browser-device-orientation/gamma" },
)
