/**
 * Report a schema validation failure that occurred on an async path (a promise
 * resolving to an invalid value).
 *
 * Sync validation throws straight out of `store.set`/`store.get`, so the caller
 * sees it. An async failure can't be thrown to that caller — the promise was
 * already handed back — and turning it into an unhandled rejection is hostile
 * (it crashes strict Node processes and Bun's test runner). So it's surfaced
 * here as a `console.error` instead (a notch louder than valdres's other
 * dev-time `console.warn` diagnostics, since invalid state is an error, not a
 * caveat). The caller does not commit the invalid value.
 *
 * Centralized so that a future programmatic hook (e.g. an `onSchemaError` store
 * option) is a single-file change rather than touching every async boundary.
 */
export const reportAsyncSchemaError = (error: unknown) => {
    console.error(error)
}
