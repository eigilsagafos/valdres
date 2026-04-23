import { atom } from "valdres"

export const publicIpV4EndpointsAtom = atom<string[]>(
    ["https://api4.ipify.org", "https://ipv4.icanhazip.com"],
    {
        global: true,
        name: "@valdres/public-ip/v4Endpoints",
    },
)
