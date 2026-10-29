import type { PublicIpFamily } from "./PublicIpFamily"

/**
 * The effective configuration of a request: what decides whether two calls
 * can share it. `signal` and `fresh` are per call and never part of it.
 */
export interface PublicIpRequestConfig {
    readonly family: PublicIpFamily
    readonly endpoints: readonly string[]
    readonly timeoutMs: number
}
