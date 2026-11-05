import { externalAtom, type ExternalAtom } from "valdres"
import { publicIpSource } from "../lib/publicIpSource"
import type { PublicIpState } from "../types/PublicIpState"

/**
 * The coherent public IP state for the IPv6 address: status, address and error from
 * one publication, shared by every Store in this page or process. Reading or
 * subscribing never sends a request; only `requestPublicIp({ family: "v6" })` does.
 */
export const publicIpV6Atom: ExternalAtom<PublicIpState> = externalAtom(
    publicIpSource("v6"),
    {
        name: "@valdres/public-ip/publicIpV6",
    },
)
