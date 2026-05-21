import type { GlobalAtom } from "valdres"
import type { OrientationSnapshot } from "../types/OrientationSnapshot"
import { orientationStatusAtom } from "../atoms/orientationStatusAtom"
import { toSnapshot } from "./toSnapshot"

export const subscribe = (
    orientationAtom: GlobalAtom<OrientationSnapshot | null>,
) => {
    if (
        typeof window === "undefined" ||
        typeof window.DeviceOrientationEvent === "undefined"
    ) {
        orientationStatusAtom.setSelf("unsupported")
        return
    }

    const handler = (event: DeviceOrientationEvent) => {
        orientationAtom.setSelf(toSnapshot(event))
    }

    window.addEventListener("deviceorientation", handler)
    orientationStatusAtom.setSelf("active")

    return () => {
        window.removeEventListener("deviceorientation", handler)
        orientationStatusAtom.setSelf("idle")
        orientationAtom.setSelf(null)
    }
}
