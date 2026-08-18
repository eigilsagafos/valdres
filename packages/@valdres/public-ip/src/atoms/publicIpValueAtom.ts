import { globalAtom } from "valdres"

export const publicIpValueAtom = globalAtom<string | null>(null, {
    name: "@valdres/public-ip/value",
})
