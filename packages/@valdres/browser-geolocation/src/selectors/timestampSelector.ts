import { selector } from "valdres"
import { positionAtom } from "../atoms/positionAtom"

export const timestampSelector = selector(
    get => get(positionAtom)?.timestamp ?? null,
    { name: "@valdres/browser-geolocation/timestamp" },
)
