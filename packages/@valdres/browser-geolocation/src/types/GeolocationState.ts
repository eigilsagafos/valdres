import type { GeolocationError } from "./GeolocationError"
import type { GeolocationSnapshot } from "./GeolocationSnapshot"
import type { GeolocationStatus } from "./GeolocationStatus"

/**
 * One coherent publication. `"active"` always carries a position and no
 * error; `"error"` always carries an error and keeps the last position, if
 * any; every other status has neither.
 */
export interface GeolocationState {
    readonly status: GeolocationStatus
    readonly position: GeolocationSnapshot | null
    readonly error: GeolocationError | null
}
