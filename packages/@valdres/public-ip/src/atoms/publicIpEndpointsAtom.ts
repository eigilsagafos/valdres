import { globalAtom } from "valdres"

export const publicIpEndpointsAtom = globalAtom<string[]>(
    ["https://api.ipify.org", "https://icanhazip.com"],
    { name: "@valdres/public-ip/endpoints" },
)
