/**
 * Provisional readings of the active measurement that is running, in the
 * units of `BandwidthResult`. `null` until that phase has produced a reading.
 * Download and upload readings move while their phase runs; they are not
 * results. The byte counts are what this measurement has transferred so far.
 */
export interface BandwidthProgress {
    readonly latencyMs: number | null
    readonly jitterMs: number | null
    readonly downloadMbps: number | null
    readonly uploadMbps: number | null
    readonly downloadBytes: number | null
    readonly uploadBytes: number | null
}
