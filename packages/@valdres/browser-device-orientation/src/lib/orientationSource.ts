import type { ExternalSource } from "valdres"
import type { OrientationState } from "../types/OrientationState"
import { IDLE, peekOrientationHub, retainOrientationHub } from "./orientationHub"
import { resolveOrientationHost } from "./resolveOrientationHost"

const UNSUPPORTED: OrientationState = Object.freeze({
    status: "unsupported",
    orientation: null,
})
const INSECURE: OrientationState = Object.freeze({ status: "insecure", orientation: null })

/** Server rendering and hydration: supported and not listening. */
export const ORIENTATION_SERVER_STATE: OrientationState = IDLE

export const orientationSource: ExternalSource<OrientationState> = {
    getSnapshot: () => {
        const host = resolveOrientationHost()
        if (host.kind === "unsupported") return UNSUPPORTED
        if (host.kind === "insecure") return INSECURE
        return peekOrientationHub(host.view) ?? IDLE
    },
    getServerSnapshot: () => ORIENTATION_SERVER_STATE,
    subscribe: invalidate => {
        const host = resolveOrientationHost()
        if (host.kind !== "supported") return () => {}
        return retainOrientationHub(host.view, invalidate)
    },
}
