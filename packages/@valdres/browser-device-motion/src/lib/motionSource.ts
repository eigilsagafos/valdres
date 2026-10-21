import type { ExternalSource } from "valdres"
import type { MotionState } from "../types/MotionState"
import { IDLE, peekMotionHub, retainMotionHub } from "./motionHub"
import { resolveMotionHost } from "./resolveMotionHost"

const UNSUPPORTED: MotionState = Object.freeze({
    status: "unsupported",
    motion: null,
})
const INSECURE: MotionState = Object.freeze({ status: "insecure", motion: null })

/** Server rendering and hydration: supported and not listening. */
export const MOTION_SERVER_STATE: MotionState = IDLE

export const motionSource: ExternalSource<MotionState> = {
    getSnapshot: () => {
        const host = resolveMotionHost()
        if (host.kind === "unsupported") return UNSUPPORTED
        if (host.kind === "insecure") return INSECURE
        return peekMotionHub(host.view) ?? IDLE
    },
    getServerSnapshot: () => MOTION_SERVER_STATE,
    subscribe: invalidate => {
        const host = resolveMotionHost()
        if (host.kind !== "supported") return () => {}
        return retainMotionHub(host.view, invalidate)
    },
}
