import { measureBandwidthOnce } from "../lib/measurementRecord"
import type { BandwidthResult } from "../types/BandwidthResult"
import type { MeasureBandwidthOptions } from "../types/MeasureBandwidthOptions"

/**
 * The explicit trigger: runs an active measurement — latency, then download,
 * then upload against the measurement server (default
 * `speed.cloudflare.com`) — and publishes its progress and outcome to
 * `bandwidthAtom` in every Store. Nothing else in this package transfers
 * data.
 *
 * A measurement deliberately loads the connection. Each throughput phase ends
 * at its byte limit (default 25 MB down, 10 MB up), its time limit (5–10 s) or
 * once stable, whichever comes first. Do not run it automatically or
 * repeatedly on metered connections.
 *
 * - Publishes `"pending"` synchronously with the running `phase` and
 *   provisional `progress`, then `"ready"` with the result, or `"error"`
 *   keeping the previous result.
 * - One measurement runs at a time per page or process. Concurrent calls with
 *   the same effective configuration (server, limits and settings) share it;
 *   a call with another configuration rejects with
 *   `BandwidthMeasurementConflictError` and leaves it alone. `fresh: true`
 *   aborts the running one (its other callers reject with `AbortError`) and
 *   starts this one.
 * - `signal` cancels only this caller. Once every caller has cancelled, the
 *   measurement is aborted and the state returns to what it was before.
 * - Only the newest measurement publishes: an older one whose readings still
 *   arrive, despite being aborted or replaced, changes nothing.
 * - Nothing retries or re-measures automatically.
 * - Not transactional: called inside a transaction, the measurement starts at
 *   once and is not rolled back if the transaction throws; the Store is
 *   notified after the transaction. Abort a `signal` to stop it.
 *
 * Errors: throws `TypeError` for invalid options, before any transfer. The
 * promise rejects with `NotSupportedError` without `fetch` or
 * `performance.now`, with the signal's reason when cancelled, with
 * `BandwidthInsufficientDataError` when a phase ends without a usable reading,
 * and with the first failed request's error otherwise. A Store subscriber that throws while
 * the state is published is reported through `globalThis.reportError` (or
 * thrown in a later task); it never changes this promise's outcome.
 */
export const measureBandwidth = (
    options?: MeasureBandwidthOptions,
): Promise<BandwidthResult> => measureBandwidthOnce(options)
