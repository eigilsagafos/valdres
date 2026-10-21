/**
 * A `GeolocationPositionError`, copied: `1` PERMISSION_DENIED (the browser has
 * ended the watch), `2` POSITION_UNAVAILABLE and `3` TIMEOUT (the watch keeps
 * running and recovers on the next position).
 */
export type GeolocationError = {
    code: 1 | 2 | 3
    message: string
}
