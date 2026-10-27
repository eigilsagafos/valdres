import type { CancelSignal } from "./CancelSignal"
import type { PublicIpFamily } from "./PublicIpFamily"

export interface PublicIpRequestOptions {
    /** Default `"any"`. Each family has its own state and its own request. */
    readonly family?: PublicIpFamily
    /**
     * Tried in order until one answers with a valid address. Each endpoint
     * receives a plain `GET` and learns the caller's address. Defaults to the
     * family's ipify endpoint, then icanhazip.
     */
    readonly endpoints?: readonly string[]
    /** Per endpoint, in milliseconds. Default `4000`. */
    readonly timeoutMs?: number
    /**
     * Cancels this caller's wait: its promise rejects with the signal's
     * reason. The request itself is aborted once every caller sharing it has
     * cancelled.
     */
    readonly signal?: CancelSignal
    /**
     * Replace an in-flight request of the same family instead of sharing it.
     * The replaced request is aborted and its callers reject with an
     * `AbortError`. Default `false`.
     */
    readonly fresh?: boolean
}
