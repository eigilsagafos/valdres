/**
 * The `PositionOptions` a watch passes to `navigator.geolocation.watchPosition`,
 * declared here so consumers without the DOM library can type against them.
 * Defaults: `enableHighAccuracy: false`, `timeout: 30_000`, `maximumAge: 0`.
 * `timeout` and `maximumAge` are milliseconds; `Infinity` is allowed.
 */
export interface GeolocationWatchOptions {
    readonly enableHighAccuracy?: boolean
    readonly timeout?: number
    readonly maximumAge?: number
}
