import { selector, type Selector } from "valdres"
import { publicIpV6Atom } from "../atoms/publicIpV6Atom"
import type { PublicIpStatus } from "../types/PublicIpStatus"

export const publicIpV6StatusAtom: Selector<PublicIpStatus> = selector(
    get => get(publicIpV6Atom).status,
    { name: "@valdres/public-ip/v6Status" },
)
