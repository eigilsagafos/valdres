import { atom } from "valdres"
import type { PublicIpStatus } from "../types/PublicIpStatus"

export const publicIpV4StatusAtom = atom<PublicIpStatus>("idle", {
    global: true,
    name: "@valdres/public-ip/v4Status",
})
