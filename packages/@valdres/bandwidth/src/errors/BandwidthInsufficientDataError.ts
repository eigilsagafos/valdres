/**
 * The rejection of a measurement whose download or upload phase produced no
 * defensible rate:
 *
 * - `"no-data"`: no payload bytes arrived (or were acknowledged) at all.
 * - `"interval-too-short"`: the bytes were carried over less than 20 ms, too
 *   short to time against a clock browsers coarsen to as much as 1 ms.
 *
 * Distinct from a completed measurement, from a cancellation (`AbortError`)
 * and from a failed request. No rate is invented for either case.
 */
export class BandwidthInsufficientDataError extends Error {
    readonly code = "VALDRES_BANDWIDTH_INSUFFICIENT_DATA"
    readonly phase: "download" | "upload"
    readonly reason: "no-data" | "interval-too-short"
    readonly bytes: number
    readonly elapsedMs: number
    constructor(
        phase: "download" | "upload",
        reason: "no-data" | "interval-too-short",
        bytes: number,
        elapsedMs: number,
    ) {
        super(
            reason === "no-data"
                ? `The ${phase} phase carried no payload bytes`
                : `The ${phase} phase carried ${bytes} bytes in ${elapsedMs.toFixed(1)} ms, too short to time; raise max${phase === "download" ? "Download" : "Upload"}Bytes for this link`,
        )
        this.name = "BandwidthInsufficientDataError"
        this.phase = phase
        this.reason = reason
        this.bytes = bytes
        this.elapsedMs = elapsedMs
    }
}
