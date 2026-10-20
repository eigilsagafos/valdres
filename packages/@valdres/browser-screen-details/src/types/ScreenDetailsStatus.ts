/**
 * - `"unsupported"`: no `window.getScreenDetails` (server, worker, browsers
 *   without the Window Management API).
 * - `"insecure"`: `window.isSecureContext` is `false`; the API is restricted
 *   to secure contexts.
 * - `"idle"`: nothing requested yet on this page.
 * - `"pending"`: `requestScreenDetails()` is waiting for the browser, which may
 *   be showing its prompt.
 * - `"ready"`: the browser granted access; screens are current.
 * - `"denied"`: the request was refused (`NotAllowedError`: the user, a
 *   `window-management` permissions policy, or a revoked permission).
 * - `"error"`: the request failed for another reason; `error` says why.
 */
export type ScreenDetailsStatus =
    | "unsupported"
    | "insecure"
    | "idle"
    | "pending"
    | "ready"
    | "denied"
    | "error"
