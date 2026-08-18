import { globalAtom } from "valdres"
import type { PublicIpStatus } from "../types/PublicIpStatus"

export const publicIpV4StatusAtom = globalAtom<PublicIpStatus>("idle", {
    name: "@valdres/public-ip/v4Status",
})
