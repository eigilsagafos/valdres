import { atom } from "valdres"
import type { PublicIpStatus } from "../types/PublicIpStatus"

export const publicIpStatusAtom = atom<PublicIpStatus>("idle", {
    global: true,
    name: "@valdres/public-ip/status",
})
