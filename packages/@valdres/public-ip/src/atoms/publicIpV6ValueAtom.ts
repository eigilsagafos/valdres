import { globalAtom } from "valdres"

export const publicIpV6ValueAtom = globalAtom<string | null>(null, {
    name: "@valdres/public-ip/v6Value",
})
