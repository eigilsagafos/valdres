import { requestPublicIpOnce } from "../lib/publicIpRecord"
import type { PublicIpRequestOptions } from "../types/PublicIpRequestOptions"

/**
 * The explicit trigger: asks the endpoints for this page's public address and
 * publishes the outcome to `publicIpAtom` (or the `V4` / `V6` atom for that
 * family) in every Store. Nothing else in this package sends a request.
 *
 * Every endpoint that is asked learns the caller's IP address, as with any
 * HTTP request. Requests send no cookies or referrer and bypass the HTTP
 * cache.
 *
 * - Publishes `"pending"` synchronously (keeping the previous address), then
 *   `"ready"` with the new address, or `"error"` keeping the previous one.
 * - Each family (`"any"`, `"v4"`, `"v6"`) has its own request and state.
 *   Within a family, concurrent calls with the same effective configuration
 *   (endpoints and timeout) share one request; a call with another
 *   configuration rejects with `PublicIpRequestConflictError` and leaves the
 *   in-flight request alone. `fresh: true` aborts the in-flight request (its
 *   other callers reject with `AbortError`) and starts this one.
 * - `signal` cancels only this caller. Once every caller has cancelled, the
 *   request is aborted and the state returns to what it was before.
 * - Only the newest request publishes: an older one that still answers,
 *   despite being aborted or replaced, changes nothing.
 * - Nothing retries or refreshes automatically.
 * - Not transactional: called inside a transaction, the request is sent at
 *   once and is not rolled back if the transaction throws; the Store is
 *   notified after the transaction. Abort a `signal` to stop it.
 *
 * Errors: throws `TypeError` for invalid options, before any request. The
 * promise rejects with `NotSupportedError` without `fetch`, with the signal's
 * reason when cancelled, and with an `AggregateError` of every endpoint's
 * failure otherwise. A Store subscriber that throws while the state is
 * published is reported through `globalThis.reportError` (or thrown in a
 * later task); it never changes this promise's outcome.
 */
export const requestPublicIp = (
    options?: PublicIpRequestOptions,
): Promise<string> => requestPublicIpOnce(options)
