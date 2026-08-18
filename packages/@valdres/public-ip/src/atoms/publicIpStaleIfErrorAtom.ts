import { globalAtom } from "valdres"

export const publicIpStaleIfErrorAtom = globalAtom<number>(Infinity, {
    name: "@valdres/public-ip/staleIfError",
})
