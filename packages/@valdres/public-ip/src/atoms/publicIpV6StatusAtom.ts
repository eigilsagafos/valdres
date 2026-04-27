import { atom } from "valdres"
import type { PublicIpStatus } from "../types/PublicIpStatus"

export const publicIpV6StatusAtom = atom<PublicIpStatus>("idle", {
    global: true,
    name: "@valdres/public-ip/v6Status",
})
