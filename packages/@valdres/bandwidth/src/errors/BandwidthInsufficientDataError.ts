/**
 * The rejection of a measurement whose download or upload phase ended without
 * a usable reading: no bytes arrived, or the phase ended (by its byte limit or
 * because its streams ran dry) before one 250 ms sampling interval. Distinct
 * from a completed measurement, from a cancellation (`AbortError`) and from a
 * failed request. Raise the phase's byte limit for a link this fast.
 */
export class BandwidthInsufficientDataError extends Error {
    readonly code = "VALDRES_BANDWIDTH_INSUFFICIENT_DATA"
    readonly phase: "download" | "upload"
    readonly bytes: number
    readonly elapsedMs: number
    constructor(
        phase: "download" | "upload",
        bytes: number,
        elapsedMs: number,
    ) {
        super(
            `The ${phase} phase ended with too little data to measure (${bytes} bytes in ${Math.round(elapsedMs)} ms)` +
                (bytes > 0
                    ? `; raise max${phase === "download" ? "Download" : "Upload"}Bytes for this link`
                    : ""),
        )
        this.name = "BandwidthInsufficientDataError"
        this.phase = phase
        this.bytes = bytes
        this.elapsedMs = elapsedMs
    }
}
