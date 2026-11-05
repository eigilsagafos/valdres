import { selector, type Selector } from "valdres"
import { publicIpAtom } from "../atoms/publicIpAtom"
import type { PublicIpStatus } from "../types/PublicIpStatus"

export const publicIpStatusAtom: Selector<PublicIpStatus> = selector(
    get => get(publicIpAtom).status,
    { name: "@valdres/public-ip/status" },
)
