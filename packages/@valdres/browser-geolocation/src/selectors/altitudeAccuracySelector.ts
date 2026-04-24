import { selector } from "valdres"
import { positionAtom } from "../atoms/positionAtom"

export const altitudeAccuracySelector = selector(
    get => get(positionAtom)?.altitudeAccuracy ?? null,
    { name: "@valdres/browser-geolocation/altitudeAccuracy" },
)
