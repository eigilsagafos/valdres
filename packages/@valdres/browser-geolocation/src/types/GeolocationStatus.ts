/**
 * - `"unsupported"`: no `navigator.geolocation` (server, worker, old engine).
 * - `"insecure"`: `isSecureContext` is `false`. Browsers refuse positions to
 *   insecure contexts, so no watch is started.
 * - `"idle"`: no watch is running in this store (or the scope it inherits from).
 * - `"pending"`: a watch started and has not reported yet — the browser may be
 *   showing its permission prompt.
 * - `"active"`: the latest report was a position.
 * - `"denied"`: the browser refused the position (PERMISSION_DENIED — the
 *   user, a permissions policy, or the browser itself) and ended the watch.
 * - `"error"`: the latest report was POSITION_UNAVAILABLE or TIMEOUT; the
 *   watch keeps running and the next position recovers it.
 */
export type GeolocationStatus =
    | "unsupported"
    | "insecure"
    | "idle"
    | "pending"
    | "active"
    | "denied"
    | "error"
