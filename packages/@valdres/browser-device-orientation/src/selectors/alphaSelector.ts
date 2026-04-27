import { selector } from "valdres"
import { orientationAtom } from "../atoms/orientationAtom"

export const alphaSelector = selector(
    get => get(orientationAtom)?.alpha ?? null,
    { name: "@valdres/browser-device-orientation/alpha" },
)
