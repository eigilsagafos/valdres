import { globalAtom } from "valdres"

export const publicIpV4ErrorAtom = globalAtom<Error | null>(null, {
    name: "@valdres/public-ip/v4Error",
})
