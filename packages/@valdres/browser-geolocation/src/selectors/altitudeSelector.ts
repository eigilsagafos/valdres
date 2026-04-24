import { selector } from "valdres"
import { positionAtom } from "../atoms/positionAtom"

export const altitudeSelector = selector(
    get => get(positionAtom)?.altitude ?? null,
    { name: "@valdres/browser-geolocation/altitude" },
)
