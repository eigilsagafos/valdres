import { selector } from "valdres"
import { orientationAtom } from "../atoms/orientationAtom"

export const gammaSelector = selector(
    get => get(orientationAtom)?.gamma ?? null,
    { name: "@valdres/browser-device-orientation/gamma" },
)
