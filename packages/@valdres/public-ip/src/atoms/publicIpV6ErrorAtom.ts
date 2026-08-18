import { globalAtom } from "valdres"

export const publicIpV6ErrorAtom = globalAtom<Error | null>(null, {
    name: "@valdres/public-ip/v6Error",
})
