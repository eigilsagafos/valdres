import type { PermissionValue } from "../../types/PermissionValue"
import { permissionAtom } from "../atoms/permissionAtom"

type IOSDeviceOrientationEvent = {
    requestPermission?: () => Promise<PermissionState>
}

export const requestOrientationPermission = async (): Promise<PermissionValue> => {
    if (
        typeof window === "undefined" ||
        typeof window.DeviceOrientationEvent === "undefined"
    ) {
        permissionAtom.setSelf("unsupported")
        return "unsupported"
    }
    const E = window.DeviceOrientationEvent as unknown as IOSDeviceOrientationEvent
    if (typeof E.requestPermission !== "function") {
        permissionAtom.setSelf("granted")
        return "granted"
    }
    try {
        const next = await E.requestPermission()
        const value: PermissionValue =
            next === "granted"
                ? "granted"
                : next === "prompt"
                  ? "prompt"
                  : "denied"
        permissionAtom.setSelf(value)
        return value
    } catch {
        // Rejection means the call could not run (insecure context, missing
        // user gesture, NotAllowedError, etc.) — NOT a user denial. Preserve
        // the current permission state so callers can retry from a real
        // gesture instead of locking the UI into a "denied" branch.
        return permissionAtom.getSelf()
    }
}
