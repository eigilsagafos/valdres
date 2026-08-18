import { globalAtom } from "valdres"

export const publicIpV4ValueAtom = globalAtom<string | null>(null, {
    name: "@valdres/public-ip/v4Value",
})
