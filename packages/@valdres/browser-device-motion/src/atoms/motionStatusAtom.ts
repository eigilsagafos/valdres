import { atom } from "valdres"
import type { MotionStatus } from "../../types/MotionStatus"

const getInitial = (): MotionStatus => {
    if (
        typeof window === "undefined" ||
        typeof window.DeviceMotionEvent === "undefined"
    ) {
        return "unsupported"
    }
    return "idle"
}

export const motionStatusAtom = atom<MotionStatus>(getInitial, {
    global: true,
    name: "@valdres/browser-device-motion/status",
})
