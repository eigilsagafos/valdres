import { atom } from "valdres"
import type { PermissionValue } from "../types/PermissionValue"

const getInitial = (): PermissionValue => {
    if (
        typeof window === "undefined" ||
        typeof window.DeviceOrientationEvent === "undefined"
    ) {
        return "unsupported"
    }
    const E = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<PermissionState>
    }
    if (typeof E.requestPermission === "function") return "prompt"
    return "granted"
}

export const permissionAtom = atom<PermissionValue>(getInitial, {
    global: true,
    name: "@valdres/browser-device-orientation/permission",
})
