/**
 * Why a throughput phase ended:
 * - `"stable"`: the rate settled after `minDurationMs`.
 * - `"time"`: it reached `maxDurationMs` without settling.
 * - `"bytes"`: it transferred its payload budget first; the reading is bytes
 *   over the measured duration (to the last counted byte), which can be short
 *   and may not represent sustained throughput.
 * - `"drained"`: every stream finished on its own (a runtime without streamed
 *   response bodies); also bytes over the measured duration.
 */
export type MeasurementPhaseEnd = "stable" | "time" | "bytes" | "drained"
