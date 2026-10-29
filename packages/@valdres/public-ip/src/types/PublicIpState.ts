import type { PublicIpError } from "./PublicIpError"
import type { PublicIpStatus } from "./PublicIpStatus"

/**
 * One coherent publication. `ip` and `updatedAt` always describe the same
 * successful response and survive a pending or failed refresh; `error` is set
 * only while `"error"`.
 */
export interface PublicIpState {
    readonly status: PublicIpStatus
    /** The last address an endpoint returned, trimmed and validated. */
    readonly ip: string | null
    /** `Date.now()` when `ip` was received. */
    readonly updatedAt: number | null
    readonly error: PublicIpError | null
}
