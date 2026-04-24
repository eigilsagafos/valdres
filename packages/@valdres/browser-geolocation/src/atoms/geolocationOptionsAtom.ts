import { atom } from "valdres"

export const geolocationOptionsAtom = atom<PositionOptions>(
    {
        enableHighAccuracy: false,
        maximumAge: 0,
        timeout: 30_000,
    },
    {
        global: true,
        name: "@valdres/browser-geolocation/options",
    },
)
