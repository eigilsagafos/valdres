import { selector, type Selector } from "valdres"
import { publicIpV4Atom } from "../atoms/publicIpV4Atom"

/** The last address received, kept while a refresh is pending or after it failed. */
export const publicIpV4ValueAtom: Selector<string | null> = selector(
    get => get(publicIpV4Atom).ip,
    { name: "@valdres/public-ip/v4Value" },
)
