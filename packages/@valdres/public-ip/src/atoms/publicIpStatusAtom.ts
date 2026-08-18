import { globalAtom } from "valdres"
import type { PublicIpStatus } from "../types/PublicIpStatus"

export const publicIpStatusAtom = globalAtom<PublicIpStatus>("idle", {
    name: "@valdres/public-ip/status",
})
