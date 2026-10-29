import type { MeasurementPhaseEnd } from "./MeasurementPhaseEnd"

/**
 * A completed active measurement against the measurement server. Throughput
 * is in megabits per second (1 Mbps = 1,000,000 bits/s), times in
 * milliseconds, transfers in bytes of request or response body.
 */
export interface BandwidthResult {
    /** Download throughput, Mbps; see `downloadEndedBy` for how it was taken. */
    readonly downloadMbps: number
    /** Upload throughput, Mbps; see `uploadEndedBy` for how it was taken. */
    readonly uploadMbps: number
    /** Median request round-trip time over the latency samples, ms. */
    readonly latencyMs: number
    /** Population standard deviation of those round-trip times, ms. */
    readonly jitterMs: number
    /** Response-body bytes the download phase received. */
    readonly downloadBytes: number
    /** Request-body bytes the upload phase sent and had acknowledged. */
    readonly uploadBytes: number
    readonly downloadEndedBy: MeasurementPhaseEnd
    readonly uploadEndedBy: MeasurementPhaseEnd
    /**
     * The interval `downloadMbps` was measured over, ms: to the last byte for
     * `"bytes"` / `"drained"`, to the end of the phase otherwise. A short
     * interval may not represent sustained throughput.
     */
    readonly downloadDurationMs: number
    /** The same for `uploadMbps`. */
    readonly uploadDurationMs: number
    /** `Date.now()` when the measurement completed. */
    readonly timestamp: number
}
