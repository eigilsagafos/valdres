import { selector, type Selector } from "valdres"
import { publicIpV6Atom } from "../atoms/publicIpV6Atom"

/** The last address received, kept while a refresh is pending or after it failed. */
export const publicIpV6ValueAtom: Selector<string | null> = selector(
    get => get(publicIpV6Atom).ip,
    { name: "@valdres/public-ip/v6Value" },
)
