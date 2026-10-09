import type { ExternalSource } from "valdres"
import type { GeolocationError } from "../types/GeolocationError"
import type { GeolocationState } from "../types/GeolocationState"
import type { NormalizedOptions } from "./normalizeOptions"
import { resolveGeolocationHost } from "./resolveGeolocationHost"
import {
    IDLE_STATE,
    INSECURE_STATE,
    PENDING_STATE,
    UNSUPPORTED_STATE,
} from "./states"
import { toSnapshot } from "./toSnapshot"

const toError = (error: GeolocationPositionError): GeolocationError => ({
    code: error.code === 1 || error.code === 3 ? error.code : 2,
    message: String(error.message ?? ""),
})

/**
 * The source behind one `watchGeolocation` session. Retaining it starts
 * exactly one `navigator.geolocation.watchPosition` with the session's
 * options, synchronously inside the caller's task; releasing it — the handle's
 * disposer or the store's disposal — clears that watch. Callbacks from a
 * cleared watch are ignored, so a late report can never land in a store that
 * stopped watching or in the session that replaced it.
 */
export const createWatchSource = (
    options: NormalizedOptions,
): ExternalSource<GeolocationState> => {
    let state: GeolocationState = PENDING_STATE
    let generation = 0
    return {
        getSnapshot: () => state,
        // A server render never runs a watch (watches start in effects and
        // handlers), so hydration must read what the server rendered, even
        // for a store whose watch already started on the client.
        getServerSnapshot: () => IDLE_STATE,
        subscribe: invalidate => {
            const host = resolveGeolocationHost()
            if (host.kind !== "supported") {
                state = host.kind === "insecure" ? INSECURE_STATE : UNSUPPORTED_STATE
                return () => {}
            }
            const current = ++generation
            const publish = (next: GeolocationState) => {
                if (current !== generation) return
                state = next
                invalidate()
            }
            const { geolocation } = host
            let id: number | undefined
            id = geolocation.watchPosition(
                position =>
                    publish(
                        Object.freeze({
                            status: "active",
                            position: toSnapshot(position),
                            error: null,
                        }),
                    ),
                error =>
                    publish(
                        Object.freeze({
                            status: "error",
                            position: state.position,
                            error: Object.freeze(toError(error)),
                        }),
                    ),
                { ...options },
            )
            return () => {
                if (current === generation) generation++
                if (id !== undefined) geolocation.clearWatch(id)
                id = undefined
            }
        },
    }
}
