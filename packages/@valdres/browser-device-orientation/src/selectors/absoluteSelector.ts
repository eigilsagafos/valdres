import { selector, type Selector } from "valdres"
import { orientationAtom } from "./orientationAtom"

export const absoluteSelector: Selector<boolean | null> = selector(
    get => get(orientationAtom)?.absolute ?? null,
    { name: "@valdres/browser-device-orientation/absolute" },
)
