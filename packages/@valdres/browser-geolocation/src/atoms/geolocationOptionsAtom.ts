import { globalAtom } from "valdres"

export const geolocationOptionsAtom = globalAtom<PositionOptions>(
    {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: 30_000,
    },
    { name: "@valdres/browser-geolocation/options" },
)
