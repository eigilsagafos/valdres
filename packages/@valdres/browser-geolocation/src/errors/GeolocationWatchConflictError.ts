import type { GeolocationWatchOptions } from "../types/GeolocationWatchOptions"

/**
 * Thrown by `watchGeolocation` when the store already has a running watch
 * with different options. A store holds one watch, shared by every caller that
 * asks for the same options; another caller's options are never silently
 * replaced. Use a separate scope (`store.scope()`) for a different watch.
 */
export class GeolocationWatchConflictError extends Error {
    readonly code = "VALDRES_GEOLOCATION_WATCH_CONFLICT"
    readonly active: Readonly<Required<GeolocationWatchOptions>>
    readonly requested: Readonly<Required<GeolocationWatchOptions>>
    constructor(
        active: Readonly<Required<GeolocationWatchOptions>>,
        requested: Readonly<Required<GeolocationWatchOptions>>,
    ) {
        super(
            `This store already watches the position with ${JSON.stringify(active)}; ` +
                `release that watch or use a scope to watch with ${JSON.stringify(requested)}`,
        )
        this.name = "GeolocationWatchConflictError"
        this.active = active
        this.requested = requested
    }
}
