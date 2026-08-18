import { globalAtom } from "valdres"
import type { PermissionValue } from "../types/PermissionValue"

const getInitial = (): PermissionValue => {
    if (
        typeof window === "undefined" ||
        typeof window.DeviceMotionEvent === "undefined"
    ) {
        return "unsupported"
    }
    const E = window.DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<PermissionState>
    }
    if (typeof E.requestPermission === "function") return "prompt"
    return "granted"
}

export const permissionAtom = globalAtom<PermissionValue>(getInitial, {
    name: "@valdres/browser-device-motion/permission",
})
