import { atom } from "valdres"
import type { GlobalAtom } from "valdres"
import type { GeolocationSnapshot } from "../../types/GeolocationSnapshot"
import { bootstrap } from "../lib/bootstrap"

// Starts navigator.geolocation.watchPosition on first read and keeps
// running until positionAtom.resetSelf() is called. Not first-subscription
// based, so it will hold GPS/Wi-Fi scanning open even with no subscribers.
export const positionAtom: GlobalAtom<GeolocationSnapshot | null> =
    atom<GeolocationSnapshot | null>(null, {
        global: true,
        name: "@valdres/browser-geolocation/position",
        onInit: () => bootstrap(positionAtom),
    })
