import type { Store } from "valdres"
import { startWatch } from "../lib/watchRegistry"
import type { GeolocationWatchOptions } from "../types/GeolocationWatchOptions"

/**
 * The explicit trigger: starts `navigator.geolocation.watchPosition` for
 * `store`, which may show the browser's location prompt. Returns an
 * idempotent disposer that stops the watch.
 *
 * - The watch publishes into `store` and the scopes below it that do not run
 *   their own; reading or subscribing alone never starts one.
 * - Callers asking the same store for the same options share one watch, which
 *   stops when the last disposer runs. Different options throw
 *   `GeolocationWatchConflictError`; use a scope for a second watch.
 * - Disposing the store stops its watch. Reports that arrive after a watch
 *   stopped are ignored.
 * - Throws `StoreDisposedError` for a disposed store and the core's
 *   capability errors inside a transaction or subscriber callback, before
 *   anything starts.
 *
 * The native call happens synchronously, so a call from a click handler keeps
 * that gesture's user activation.
 */
export const watchGeolocation = (
    store: Store,
    options?: GeolocationWatchOptions,
): (() => void) => startWatch(store, options)
