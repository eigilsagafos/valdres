import { globalStore } from "valdres"
import type { GlobalAtom } from "valdres"
import type { GeolocationSnapshot } from "../types/GeolocationSnapshot"
import { geolocationErrorAtom } from "../atoms/geolocationErrorAtom"
import { geolocationOptionsAtom } from "../atoms/geolocationOptionsAtom"
import { geolocationStatusAtom } from "../atoms/geolocationStatusAtom"
import { toSnapshot } from "./toSnapshot"

export const bootstrap = (
    positionAtom: GlobalAtom<GeolocationSnapshot | null>,
) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
        geolocationStatusAtom.setSelf("unsupported")
        return
    }

    let watchId: number | undefined
    const geo = navigator.geolocation

    const onSuccess = (position: GeolocationPosition) => {
        positionAtom.setSelf(toSnapshot(position))
        geolocationErrorAtom.setSelf(null)
        geolocationStatusAtom.setSelf("active")
    }

    const onError = (err: GeolocationPositionError) => {
        geolocationErrorAtom.setSelf({
            code: err.code as 1 | 2 | 3,
            message: err.message,
        })
        geolocationStatusAtom.setSelf("error")
    }

    const start = () => {
        if (watchId !== undefined) geo.clearWatch(watchId)
        geolocationErrorAtom.setSelf(null)
        geolocationStatusAtom.setSelf("pending")
        watchId = geo.watchPosition(
            onSuccess,
            onError,
            geolocationOptionsAtom.getSelf(),
        )
    }

    start()
    const unsubscribeOptions = globalStore.sub(geolocationOptionsAtom, start)

    return () => {
        unsubscribeOptions()
        if (watchId !== undefined) geo.clearWatch(watchId)
        geolocationErrorAtom.setSelf(null)
        geolocationStatusAtom.setSelf("idle")
    }
}
