/**
 * The `"geolocation"` permission as the Permissions API reports it, or
 * `"unsupported"` when it cannot be observed: no Permissions API, a query the
 * engine rejects, no `navigator.geolocation`, or an insecure context.
 */
export type PermissionValue = "granted" | "denied" | "prompt" | "unsupported"
