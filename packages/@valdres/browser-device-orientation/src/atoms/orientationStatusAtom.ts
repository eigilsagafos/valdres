import { globalAtom } from "valdres"
import type { OrientationStatus } from "../types/OrientationStatus"

const getInitial = (): OrientationStatus => {
    if (
        typeof window === "undefined" ||
        typeof window.DeviceOrientationEvent === "undefined"
    ) {
        return "unsupported"
    }
    return "idle"
}

export const orientationStatusAtom = globalAtom<OrientationStatus>(
    getInitial,
    { name: "@valdres/browser-device-orientation/status" },
)
