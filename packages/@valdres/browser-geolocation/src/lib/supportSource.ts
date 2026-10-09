import type { ExternalSource } from "valdres"
import type { GeolocationState } from "../types/GeolocationState"
import { resolveGeolocationHost } from "./resolveGeolocationHost"
import { IDLE_STATE, INSECURE_STATE, UNSUPPORTED_STATE } from "./states"

/** What a store without a watch reports. Static: nothing to subscribe to. */
export const supportSource: ExternalSource<GeolocationState> = {
    getSnapshot: () => {
        const host = resolveGeolocationHost()
        if (host.kind === "unsupported") return UNSUPPORTED_STATE
        if (host.kind === "insecure") return INSECURE_STATE
        return IDLE_STATE
    },
    getServerSnapshot: () => IDLE_STATE,
    subscribe: () => () => {},
}
