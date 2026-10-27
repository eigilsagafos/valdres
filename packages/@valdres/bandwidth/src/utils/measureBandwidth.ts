import { measureBandwidthOnce } from "../lib/measurementRecord"
import type { BandwidthResult } from "../types/BandwidthResult"
import type { MeasureBandwidthOptions } from "../types/MeasureBandwidthOptions"

/**
 * The explicit trigger: runs an active measurement — latency, then download,
 * then upload against `speed.cloudflare.com` — and publishes its progress and
 * outcome to `bandwidthAtom` in every Store. Nothing else in this package
 * transfers data.
 *
 * A measurement deliberately saturates the connection: with the defaults each
 * throughput phase runs for 5–10 s on 2–8 parallel streams, so it moves
 * roughly (throughput × duration) of data in each direction — hundreds of
 * megabytes on a fast link. Do not run it automatically or repeatedly on
 * metered connections.
 *
 * - Publishes `"pending"` synchronously with the running `phase` and
 *   provisional `progress`, then `"ready"` with the result, or `"error"`
 *   keeping the previous result.
 * - Concurrent calls share one measurement; a joining call's options are
 *   ignored. `fresh: true` aborts the running one (its callers reject with
 *   `AbortError`) and starts a new one.
 * - `signal` cancels only this caller. Once every caller has cancelled, the
 *   measurement is aborted and the state returns to what it was before.
 * - Only the newest measurement publishes: an older one whose readings still
 *   arrive, despite being aborted or replaced, changes nothing.
 * - Nothing retries or re-measures automatically.
 *
 * Errors: throws `TypeError` for invalid options, before any transfer. The
 * promise rejects with `NotSupportedError` without `fetch` or
 * `performance.now`, with the signal's reason when cancelled, and with the
 * first failed request's error otherwise. A Store subscriber that throws while
 * the state is published is reported through `globalThis.reportError` (or
 * thrown in a later task); it never changes this promise's outcome.
 */
export const measureBandwidth = (
    options?: MeasureBandwidthOptions,
): Promise<BandwidthResult> => measureBandwidthOnce(options)
