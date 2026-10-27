import { selector, type Selector } from "valdres"
import { publicIpV6Atom } from "../atoms/publicIpV6Atom"
import type { PublicIpError } from "../types/PublicIpError"

/** Why the latest request failed; `null` unless the status is `"error"`. */
export const publicIpV6ErrorAtom: Selector<PublicIpError | null> = selector(
    get => get(publicIpV6Atom).error,
    { name: "@valdres/public-ip/v6Error" },
)
