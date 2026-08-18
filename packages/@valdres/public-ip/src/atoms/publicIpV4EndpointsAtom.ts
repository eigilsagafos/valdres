import { globalAtom } from "valdres"

export const publicIpV4EndpointsAtom = globalAtom<string[]>(
    ["https://api4.ipify.org", "https://ipv4.icanhazip.com"],
    { name: "@valdres/public-ip/v4Endpoints" },
)
