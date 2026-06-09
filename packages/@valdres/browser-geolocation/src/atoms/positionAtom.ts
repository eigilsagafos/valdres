import { atom } from "valdres"
import type { GlobalAtom } from "valdres"
import type { GeolocationSnapshot } from "../types/GeolocationSnapshot"
import { bootstrap } from "../lib/bootstrap"

// Starts navigator.geolocation.watchPosition on first subscription. The
// returned cleanup runs when the last subscriber unsubscribes, which stops
// GPS/Wi-Fi scanning to keep battery usage in check.
export const positionAtom: GlobalAtom<GeolocationSnapshot | null> =
    atom<GeolocationSnapshot | null>(null, {
        global: true,
        name: "@valdres/browser-geolocation/position",
        onMount: () => bootstrap(positionAtom),
    })
