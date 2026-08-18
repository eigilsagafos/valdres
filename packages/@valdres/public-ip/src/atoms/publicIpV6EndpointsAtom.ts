import { globalAtom } from "valdres"

export const publicIpV6EndpointsAtom = globalAtom<string[]>(
    ["https://api6.ipify.org", "https://ipv6.icanhazip.com"],
    { name: "@valdres/public-ip/v6Endpoints" },
)
