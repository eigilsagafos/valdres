import { selector } from "valdres"
import { positionAtom } from "../atoms/positionAtom"

export const coordsSelector = selector(
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
