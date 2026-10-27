import type { MeasureBandwidthOptions } from "../types/MeasureBandwidthOptions"

export interface NormalizedOptions {
    readonly latencySamples: number
    readonly maxDurationMs: number
    readonly minDurationMs: number
    readonly warmupMs: number
    readonly startStreams: number
    readonly maxStreams: number
    readonly stabilityThreshold: number
}

const DEFAULTS: NormalizedOptions = {
    latencySamples: 10,
    maxDurationMs: 10_000,
    minDurationMs: 5_000,
    warmupMs: 2_000,
    startStreams: 2,
    maxStreams: 8,
    stabilityThreshold: 0.05,
}

const isCount = (value: number) => Number.isInteger(value) && value >= 1
const isDuration = (value: number) => Number.isFinite(value) && value >= 0

/**
 * Throws `TypeError` for options no measurement could honour, before any
 * work. `signal` and `fresh` are returned separately.
 */
export const normalizeOptions = (options: MeasureBandwidthOptions = {}) => {
    if (typeof options !== "object" || options === null)
        throw new TypeError("bandwidth options must be an object")
    const { signal, fresh = false, ...rest } = options
    const normalized: NormalizedOptions = { ...DEFAULTS }
    for (const key of Object.keys(DEFAULTS) as (keyof NormalizedOptions)[]) {
        const value = rest[key]
        if (value === undefined) continue
        if (typeof value !== "number")
            throw new TypeError(`bandwidth ${key} must be a number`)
        ;(normalized as { -readonly [K in keyof NormalizedOptions]: number })[
            key
        ] = value
    }
    const valid =
        isCount(normalized.latencySamples) &&
        isCount(normalized.startStreams) &&
        isCount(normalized.maxStreams) &&
        normalized.maxStreams >= normalized.startStreams &&
        isDuration(normalized.warmupMs) &&
        isDuration(normalized.minDurationMs) &&
        isDuration(normalized.maxDurationMs) &&
        normalized.maxDurationMs > 0 &&
        normalized.maxDurationMs >= normalized.minDurationMs &&
        normalized.stabilityThreshold > 0
    if (!valid)
        throw new TypeError(
            "bandwidth options need positive integer sample and stream counts (maxStreams >= startStreams), non-negative durations with maxDurationMs > 0 and >= minDurationMs, and a positive stabilityThreshold",
        )
    return { options: Object.freeze(normalized), signal, fresh: fresh === true }
}
