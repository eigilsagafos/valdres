import { globalAtom } from "valdres"
import type { PublicIpStatus } from "../types/PublicIpStatus"

export const publicIpV6StatusAtom = globalAtom<PublicIpStatus>("idle", {
    name: "@valdres/public-ip/v6Status",
})
