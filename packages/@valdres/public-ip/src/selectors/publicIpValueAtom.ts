import { selector, type Selector } from "valdres"
import { publicIpAtom } from "../atoms/publicIpAtom"

/** The last address received, kept while a refresh is pending or after it failed. */
export const publicIpValueAtom: Selector<string | null> = selector(
    get => get(publicIpAtom).ip,
    { name: "@valdres/public-ip/value" },
)
