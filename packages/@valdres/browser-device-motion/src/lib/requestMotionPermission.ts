import type { PermissionValue } from "../../types/PermissionValue"
import { permissionAtom } from "../atoms/permissionAtom"

type IOSDeviceMotionEvent = {
    requestPermission?: () => Promise<PermissionState>
}

export const requestMotionPermission = async (): Promise<PermissionValue> => {
    if (
        typeof window === "undefined" ||
        typeof window.DeviceMotionEvent === "undefined"
    ) {
        permissionAtom.setSelf("unsupported")
        return "unsupported"
    }
    const E = window.DeviceMotionEvent as unknown as IOSDeviceMotionEvent
    if (typeof E.requestPermission !== "function") {
        permissionAtom.setSelf("granted")
        return "granted"
    }
    try {
        const next = await E.requestPermission()
        const value: PermissionValue = next === "granted" ? "granted" : "denied"
        permissionAtom.setSelf(value)
        return value
    } catch {
        permissionAtom.setSelf("denied")
        return "denied"
    }
}
