import { globalAtom } from "valdres"

export const publicIpErrorAtom = globalAtom<Error | null>(null, {
    name: "@valdres/public-ip/error",
})
