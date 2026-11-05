import type { BandwidthMeasurementConfig } from "../types/BandwidthMeasurementConfig"
import type { MeasureBandwidthOptions } from "../types/MeasureBandwidthOptions"
import { DEFAULT_ENDPOINTS } from "./endpoints"

type Numeric = Exclude<keyof BandwidthMeasurementConfig, "endpoints">

const DEFAULTS: { readonly [K in Numeric]: number } = {
    latencySamples: 10,
    maxDurationMs: 10_000,
    minDurationMs: 5_000,
    warmupMs: 2_000,
    startStreams: 2,
    maxStreams: 8,
    stabilityThreshold: 0.05,
    maxDownloadBytes: 25_000_000,
    maxUploadBytes: 10_000_000,
}

const isCount = (value: number) => Number.isInteger(value) && value >= 1
const isDuration = (value: number) => Number.isFinite(value) && value >= 0
const isLimit = (value: number) =>
    value === Infinity || (Number.isInteger(value) && value >= 1)

/**
 * Throws `TypeError` for options no measurement could honour, before any
 * work. Returns the effective configuration plus the per-call `signal` and
 * `fresh`.
 */
export const normalizeOptions = (options: MeasureBandwidthOptions = {}) => {
    if (typeof options !== "object" || options === null)
        throw new TypeError("bandwidth options must be an object")
    const {
        signal,
        fresh = false,
        endpoints = DEFAULT_ENDPOINTS,
        ...rest
    } = options
    if (
        typeof endpoints !== "object" ||
        endpoints === null ||
        typeof endpoints.download !== "string" ||
        endpoints.download === "" ||
        typeof endpoints.upload !== "string" ||
        endpoints.upload === ""
    )
        throw new TypeError(
            "bandwidth endpoints need non-empty download and upload URLs",
        )
    const numbers = { ...DEFAULTS } as { [K in Numeric]: number }
    for (const key of Object.keys(DEFAULTS) as Numeric[]) {
        const value = rest[key]
        if (value === undefined) continue
        if (typeof value !== "number")
            throw new TypeError(`bandwidth ${key} must be a number`)
        numbers[key] = value
    }
    const valid =
        isCount(numbers.latencySamples) &&
        isCount(numbers.startStreams) &&
        isCount(numbers.maxStreams) &&
        numbers.maxStreams >= numbers.startStreams &&
        isDuration(numbers.warmupMs) &&
        isDuration(numbers.minDurationMs) &&
        isDuration(numbers.maxDurationMs) &&
        numbers.maxDurationMs > 0 &&
        numbers.maxDurationMs >= numbers.minDurationMs &&
        numbers.stabilityThreshold > 0 &&
        isLimit(numbers.maxDownloadBytes) &&
        isLimit(numbers.maxUploadBytes)
    if (!valid)
        throw new TypeError(
            "bandwidth options need positive integer sample and stream counts (maxStreams >= startStreams), non-negative durations with maxDurationMs > 0 and >= minDurationMs, a positive stabilityThreshold, and byte limits that are positive integers or Infinity",
        )
    const config: BandwidthMeasurementConfig = Object.freeze({
        ...numbers,
        endpoints: Object.freeze({
            download: endpoints.download,
            upload: endpoints.upload,
        }),
    })
    return { config, signal, fresh: fresh === true }
}

export const sameConfig = (
    a: BandwidthMeasurementConfig,
    b: BandwidthMeasurementConfig,
) =>
    a.endpoints.download === b.endpoints.download &&
    a.endpoints.upload === b.endpoints.upload &&
    (Object.keys(DEFAULTS) as Numeric[]).every(key => a[key] === b[key])
