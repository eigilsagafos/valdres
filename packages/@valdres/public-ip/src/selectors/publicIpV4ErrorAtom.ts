import { selector, type Selector } from "valdres"
import { publicIpV4Atom } from "../atoms/publicIpV4Atom"
import type { PublicIpError } from "../types/PublicIpError"

/** Why the latest request failed; `null` unless the status is `"error"`. */
export const publicIpV4ErrorAtom: Selector<PublicIpError | null> = selector(
    get => get(publicIpV4Atom).error,
    { name: "@valdres/public-ip/v4Error" },
)
