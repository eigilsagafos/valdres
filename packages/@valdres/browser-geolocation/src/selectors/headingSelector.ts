import { selector } from "valdres"
import { positionAtom } from "../atoms/positionAtom"

export const headingSelector = selector(
    get => get(positionAtom)?.heading ?? null,
    { name: "@valdres/browser-geolocation/heading" },
)
