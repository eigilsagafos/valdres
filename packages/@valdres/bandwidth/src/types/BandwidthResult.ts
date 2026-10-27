/**
 * A completed active measurement against the measurement server. Throughput
 * is in megabits per second (1 Mbps = 1,000,000 bits/s), times in
 * milliseconds.
 */
export interface BandwidthResult {
    /** Smoothed download throughput at the end of the download phase, Mbps. */
    readonly downloadMbps: number
    /** Smoothed upload throughput at the end of the upload phase, Mbps. */
    readonly uploadMbps: number
    /** Median request round-trip time over the latency samples, ms. */
    readonly latencyMs: number
    /** Population standard deviation of those round-trip times, ms. */
    readonly jitterMs: number
    /** `Date.now()` when the measurement completed. */
    readonly timestamp: number
}
