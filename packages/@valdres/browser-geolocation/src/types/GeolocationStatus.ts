/**
 * - `"unsupported"`: no `navigator.geolocation` (server, worker, old engine).
 * - `"insecure"`: `isSecureContext` is `false`. Browsers refuse positions to
 *   insecure contexts, so no watch is started.
 * - `"idle"`: no watch is running in this store (or the scope it inherits from).
 * - `"pending"`: a watch started and has not reported yet — the browser may be
 *   showing its permission prompt.
 * - `"active"`: the latest report was a position.
 * - `"error"`: the latest report was an error; `error` says which.
 */
export type GeolocationStatus =
    | "unsupported"
    | "insecure"
    | "idle"
    | "pending"
    | "active"
    | "error"
