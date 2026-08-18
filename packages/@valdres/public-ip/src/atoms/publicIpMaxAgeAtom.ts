import { globalAtom } from "valdres"

export const publicIpMaxAgeAtom = globalAtom<number>(5 * 60 * 1000, {
    name: "@valdres/public-ip/maxAge",
})
