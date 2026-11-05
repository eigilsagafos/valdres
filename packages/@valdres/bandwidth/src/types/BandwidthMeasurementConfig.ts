import type { BandwidthEndpoints } from "./BandwidthEndpoints"

/**
 * The effective configuration of a measurement: every option except `signal`
 * and `fresh`, with defaults applied. Two calls share a measurement only when
 * their configurations are equal.
 */
export interface BandwidthMeasurementConfig {
    readonly endpoints: BandwidthEndpoints
    readonly latencySamples: number
    readonly maxDurationMs: number
    readonly minDurationMs: number
    readonly warmupMs: number
    readonly startStreams: number
    readonly maxStreams: number
    readonly stabilityThreshold: number
    readonly maxDownloadBytes: number
    readonly maxUploadBytes: number
}
