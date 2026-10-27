import type { PublicIpFamily } from "../types/PublicIpFamily"
import type { PublicIpRequestOptions } from "../types/PublicIpRequestOptions"
import { DEFAULT_ENDPOINTS, DEFAULT_TIMEOUT_MS } from "./endpoints"

export interface NormalizedOptions {
    readonly family: PublicIpFamily
    readonly endpoints: readonly string[]
    readonly timeoutMs: number
    readonly signal: AbortSignal | undefined
    readonly fresh: boolean
}

const FAMILIES: readonly string[] = ["any", "v4", "v6"]

/** Throws `TypeError` for options no request could honour, before any work. */
export const normalizeOptions = (
    options: PublicIpRequestOptions = {},
): NormalizedOptions => {
    if (typeof options !== "object" || options === null)
        throw new TypeError("public-ip options must be an object")
    const {
        family = "any",
        endpoints,
        timeoutMs = DEFAULT_TIMEOUT_MS,
        signal,
        fresh = false,
    } = options
    if (!FAMILIES.includes(family))
        throw new TypeError(
            `public-ip family must be "any", "v4" or "v6", got ${String(family)}`,
        )
    if (
        endpoints !== undefined &&
        (!Array.isArray(endpoints) ||
            endpoints.length === 0 ||
            !endpoints.every(
                endpoint => typeof endpoint === "string" && endpoint !== "",
            ))
    )
        throw new TypeError(
            "public-ip endpoints must be a non-empty array of URLs",
        )
    if (typeof timeoutMs !== "number" || !(timeoutMs > 0))
        throw new TypeError("public-ip timeoutMs must be a positive number")
    return {
        family,
        endpoints:
            endpoints === undefined
                ? DEFAULT_ENDPOINTS[family]
                : Object.freeze([...endpoints]),
        timeoutMs,
        signal,
        fresh: fresh === true,
    }
}
