export type MeasureBandwidthOptions = {
    latencySamples?: number
    maxDurationMs?: number
    minDurationMs?: number
    warmupMs?: number
    startStreams?: number
    maxStreams?: number
    stabilityThreshold?: number
    signal?: AbortSignal
    fresh?: boolean
}
