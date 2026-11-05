import type { PublicIpFamily } from "../types/PublicIpFamily"

/** The endpoints the package has always used; nothing is contacted unless a
 *  request is made. */
export const DEFAULT_ENDPOINTS: Readonly<
    Record<PublicIpFamily, readonly string[]>
> = Object.freeze({
    any: Object.freeze(["https://api.ipify.org", "https://icanhazip.com"]),
    v4: Object.freeze(["https://api4.ipify.org", "https://ipv4.icanhazip.com"]),
    v6: Object.freeze(["https://api6.ipify.org", "https://ipv6.icanhazip.com"]),
})

export const DEFAULT_TIMEOUT_MS = 4000
