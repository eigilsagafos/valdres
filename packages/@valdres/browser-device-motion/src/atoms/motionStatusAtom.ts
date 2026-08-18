import { globalAtom } from "valdres"
import type { MotionStatus } from "../types/MotionStatus"

const getInitial = (): MotionStatus => {
    if (
        typeof window === "undefined" ||
        typeof window.DeviceMotionEvent === "undefined"
    ) {
        return "unsupported"
    }
    return "idle"
}

export const motionStatusAtom = globalAtom<MotionStatus>(getInitial, {
    name: "@valdres/browser-device-motion/status",
})
