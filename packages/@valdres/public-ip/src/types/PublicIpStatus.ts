/**
 * - `"unsupported"`: the runtime has no `fetch`.
 * - `"idle"`: nothing was requested yet in this page or process.
 * - `"pending"`: a request is in flight; `ip` still holds the previous
 *   address, if any.
 * - `"ready"`: the latest request succeeded; `ip` is its address.
 * - `"error"`: the latest request failed; `error` says why and `ip` keeps the
 *   previous address, if any.
 */
export type PublicIpStatus =
    | "unsupported"
    | "idle"
    | "pending"
    | "ready"
    | "error"
