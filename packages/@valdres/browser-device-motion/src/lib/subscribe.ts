import type { GlobalAtom } from "valdres"
import type { MotionSnapshot } from "../../types/MotionSnapshot"
import { motionStatusAtom } from "../atoms/motionStatusAtom"
import { toSnapshot } from "./toSnapshot"

export const subscribe = (motionAtom: GlobalAtom<MotionSnapshot | null>) => {
    if (
        typeof window === "undefined" ||
        typeof window.DeviceMotionEvent === "undefined"
    ) {
        motionStatusAtom.setSelf("unsupported")
        return
    }

    const handler = (event: DeviceMotionEvent) => {
        motionAtom.setSelf(toSnapshot(event))
    }

    window.addEventListener("devicemotion", handler)
    motionStatusAtom.setSelf("active")

    return () => {
        window.removeEventListener("devicemotion", handler)
        motionStatusAtom.setSelf("idle")
        motionAtom.setSelf(null)
    }
}
