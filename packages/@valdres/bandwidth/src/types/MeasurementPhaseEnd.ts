/**
 * Why a throughput phase ended:
 * - `"stable"`: the rate settled after `minDurationMs`.
 * - `"time"`: it reached `maxDurationMs` without settling.
 * - `"bytes"`: it transferred its byte limit first; the reading is the phase's
 *   average rate, a lower bound on a link faster than the limit allows to
 *   measure.
 * - `"drained"`: every stream finished on its own (a runtime without streamed
 *   response bodies); also an average rate.
 */
export type MeasurementPhaseEnd = "stable" | "time" | "bytes" | "drained"
