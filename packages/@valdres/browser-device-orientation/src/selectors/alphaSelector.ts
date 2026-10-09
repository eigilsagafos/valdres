import { selector, type Selector } from "valdres"
import { orientationAtom } from "./orientationAtom"

export const alphaSelector: Selector<number | null> = selector(
    get => get(orientationAtom)?.alpha ?? null,
    { name: "@valdres/browser-device-orientation/alpha" },
)
