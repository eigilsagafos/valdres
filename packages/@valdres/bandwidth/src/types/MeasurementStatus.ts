/**
 * - `"unsupported"`: the runtime has no `fetch` or `performance.now`.
 * - `"idle"`: nothing was measured yet in this page or process.
 * - `"pending"`: a measurement is running; `phase` and `progress` follow it.
 * - `"ready"`: the latest measurement completed; `result` is its outcome.
 * - `"error"`: the latest measurement failed; `error` says why and `result`
 *   keeps the previous outcome, if any.
 */
export type MeasurementStatus =
    | "unsupported"
    | "idle"
    | "pending"
    | "ready"
    | "error"
