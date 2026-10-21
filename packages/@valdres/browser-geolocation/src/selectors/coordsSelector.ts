import { selector, type Selector } from "valdres"
import { positionAtom } from "./positionAtom"

export const coordsSelector: Selector<{ latitude: number; longitude: number } | null> = selector(
    get => {
        const position = get(positionAtom)
        if (!position) return null
        return {
            latitude: position.latitude,
            longitude: position.longitude,
        }
    },
    { name: "@valdres/browser-geolocation/coords" },
)
