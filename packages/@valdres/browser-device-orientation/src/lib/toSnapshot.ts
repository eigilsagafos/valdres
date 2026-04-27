import type { OrientationSnapshot } from "../../types/OrientationSnapshot"

type WebkitOrientationEvent = DeviceOrientationEvent & {
    webkitCompassHeading?: number | null
    webkitCompassAccuracy?: number | null
}

export const toSnapshot = (event: DeviceOrientationEvent): OrientationSnapshot => {
    const e = event as WebkitOrientationEvent
    return {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
        absolute: event.absolute,
        webkitCompassHeading: e.webkitCompassHeading ?? null,
        webkitCompassAccuracy: e.webkitCompassAccuracy ?? null,
        timestamp: event.timeStamp,
    }
}
