import { atom } from "valdres"

export const publicIpEndpointsAtom = atom<string[]>(
    ["https://api.ipify.org", "https://icanhazip.com"],
    {
        global: true,
        name: "@valdres/public-ip/endpoints",
    },
)
