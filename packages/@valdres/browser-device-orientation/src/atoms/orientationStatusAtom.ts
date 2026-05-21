import { atom } from "valdres"
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

export const orientationStatusAtom = atom<OrientationStatus>(getInitial, {
    global: true,
    name: "@valdres/browser-device-orientation/status",
})
