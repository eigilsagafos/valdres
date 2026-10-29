import { selector, type Selector } from "valdres"
import { publicIpAtom } from "../atoms/publicIpAtom"
import type { PublicIpError } from "../types/PublicIpError"

/** Why the latest request failed; `null` unless the status is `"error"`. */
export const publicIpErrorAtom: Selector<PublicIpError | null> = selector(
    get => get(publicIpAtom).error,
    { name: "@valdres/public-ip/error" },
)
