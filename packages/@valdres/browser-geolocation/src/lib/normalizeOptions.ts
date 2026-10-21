import type { GeolocationWatchOptions } from "../types/GeolocationWatchOptions"

export type NormalizedOptions = Required<GeolocationWatchOptions>

const DEFAULTS: NormalizedOptions = {
    enableHighAccuracy: false,
    timeout: 30_000,
    maximumAge: 0,
}

const duration = (name: string, value: unknown, fallback: number): number => {
    if (value === undefined) return fallback
    if (typeof value !== "number" || Number.isNaN(value) || value < 0)
        throw new TypeError(
            `watchGeolocation options.${name} must be a non-negative number`,
        )
    return value
}

/** Validates and fills defaults; the result is frozen and comparable. */
export const normalizeOptions = (
    options: GeolocationWatchOptions | undefined,
): NormalizedOptions => {
    if (options === undefined) return Object.freeze({ ...DEFAULTS })
    if (typeof options !== "object" || options === null)
        throw new TypeError("watchGeolocation options must be an object")
    const { enableHighAccuracy } = options
    if (enableHighAccuracy !== undefined && typeof enableHighAccuracy !== "boolean")
        throw new TypeError(
            "watchGeolocation options.enableHighAccuracy must be a boolean",
        )
    return Object.freeze({
        enableHighAccuracy: enableHighAccuracy ?? DEFAULTS.enableHighAccuracy,
        timeout: duration("timeout", options.timeout, DEFAULTS.timeout),
        maximumAge: duration("maximumAge", options.maximumAge, DEFAULTS.maximumAge),
    })
}

export const sameOptions = (a: NormalizedOptions, b: NormalizedOptions) =>
    a.enableHighAccuracy === b.enableHighAccuracy &&
    a.timeout === b.timeout &&
    a.maximumAge === b.maximumAge
