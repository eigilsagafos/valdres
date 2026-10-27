export interface MeasureBandwidthOptions {
    /** Round trips timed after one warm-up request. Default `10`. */
    readonly latencySamples?: number
    /** Upper bound per throughput phase, ms. Default `10000`. */
    readonly maxDurationMs?: number
    /** A phase may end early once stable, but not before this, ms. Default `5000`. */
    readonly minDurationMs?: number
    /** Readings ignored for stability at the start of a phase, ms. Default `2000`. */
    readonly warmupMs?: number
    /** Parallel streams a phase starts with. Default `2`. */
    readonly startStreams?: number
    /** Parallel streams a phase may ramp up to. Default `8`. */
    readonly maxStreams?: number
    /** Coefficient of variation below which a phase counts as stable. Default `0.05`. */
    readonly stabilityThreshold?: number
    /**
     * Cancels this caller's wait: its promise rejects with the signal's
     * reason. The measurement itself is aborted once every caller sharing it
     * has cancelled.
     */
    readonly signal?: AbortSignal
    /**
     * Replace a running measurement instead of sharing it. The replaced one is
     * aborted and its callers reject with an `AbortError`. Default `false`.
     */
    readonly fresh?: boolean
}
