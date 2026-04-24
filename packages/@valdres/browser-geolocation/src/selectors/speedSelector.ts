import { selector } from "valdres"
import { positionAtom } from "../atoms/positionAtom"

export const speedSelector = selector(
    get => get(positionAtom)?.speed ?? null,
    { name: "@valdres/browser-geolocation/speed" },
)
