import { selector, type Selector } from "valdres"
import { publicIpV4Atom } from "../atoms/publicIpV4Atom"
import type { PublicIpStatus } from "../types/PublicIpStatus"

export const publicIpV4StatusAtom: Selector<PublicIpStatus> = selector(
    get => get(publicIpV4Atom).status,
    { name: "@valdres/public-ip/v4Status" },
)
