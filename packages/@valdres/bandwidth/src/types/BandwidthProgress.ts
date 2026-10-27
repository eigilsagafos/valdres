/**
 * Provisional readings of the measurement that is running, in the units of
 * `BandwidthResult`. `null` until that phase has produced a reading. Download
 * and upload readings move while their phase runs; they are not results.
 */
export interface BandwidthProgress {
    readonly latencyMs: number | null
    readonly jitterMs: number | null
    readonly downloadMbps: number | null
    readonly uploadMbps: number | null
}
