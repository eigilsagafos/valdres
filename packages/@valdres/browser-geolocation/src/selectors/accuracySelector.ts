import { selector } from "valdres"
import { positionAtom } from "../atoms/positionAtom"

export const accuracySelector = selector(
    get => get(positionAtom)?.accuracy ?? null,
    { name: "@valdres/browser-geolocation/accuracy" },
)
