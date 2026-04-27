import { selector } from "valdres"
import { orientationAtom } from "../atoms/orientationAtom"

export const betaSelector = selector(
    get => get(orientationAtom)?.beta ?? null,
    { name: "@valdres/browser-device-orientation/beta" },
)
