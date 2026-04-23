import { atom } from "valdres"

export const publicIpV6EndpointsAtom = atom<string[]>(
    ["https://api6.ipify.org", "https://ipv6.icanhazip.com"],
    {
        global: true,
        name: "@valdres/public-ip/v6Endpoints",
    },
)
