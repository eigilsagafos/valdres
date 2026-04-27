import { selector } from "valdres"
import { orientationAtom } from "../atoms/orientationAtom"

export const absoluteSelector = selector(
    get => get(orientationAtom)?.absolute ?? null,
    { name: "@valdres/browser-device-orientation/absolute" },
)
