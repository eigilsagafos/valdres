import { notSupportedError } from "../lib/domErrors"
import { lookupPublicIp } from "../lib/lookupPublicIp"
import { normalizeOptions } from "../lib/normalizeOptions"
import type { PublicIpRequestOptions } from "../types/PublicIpRequestOptions"

/**
 * Stateless lookup: the same request as `requestPublicIp`, but it publishes
 * nothing and shares nothing, so concurrent calls make concurrent requests.
 * Use it on servers, where the package's state would be shared by every
 * request the process handles. `fresh` has no effect. Throws `TypeError` for
 * invalid options, like `requestPublicIp`.
 */
export const fetchPublicIp = (
    options?: PublicIpRequestOptions,
): Promise<string> => {
    const normalized = normalizeOptions(options)
    if (typeof fetch !== "function")
        return Promise.reject(notSupportedError("This runtime has no fetch"))
    return lookupPublicIp(normalized, normalized.signal)
}
