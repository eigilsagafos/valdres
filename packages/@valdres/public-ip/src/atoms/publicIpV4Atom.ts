import { externalAtom, type ExternalAtom } from "valdres"
import { publicIpSource } from "../lib/publicIpSource"
import type { PublicIpState } from "../types/PublicIpState"

/**
 * The coherent public IP state for the IPv4 address: status, address and error from
 * one publication, shared by every Store in this page or process. Reading or
 * subscribing never sends a request; only `requestPublicIp({ family: "v4" })` does.
 */
export const publicIpV4Atom: ExternalAtom<PublicIpState> = externalAtom(
    publicIpSource("v4"),
    {
        name: "@valdres/public-ip/publicIpV4",
    },
)
