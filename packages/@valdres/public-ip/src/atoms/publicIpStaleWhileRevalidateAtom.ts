import { globalAtom } from "valdres"

export const publicIpStaleWhileRevalidateAtom = globalAtom<number>(Infinity, {
    name: "@valdres/public-ip/staleWhileRevalidate",
})
