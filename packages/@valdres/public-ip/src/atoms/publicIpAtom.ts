import { externalAtom, type ExternalAtom } from "valdres"
import { publicIpSource } from "../lib/publicIpSource"
import type { PublicIpState } from "../types/PublicIpState"

/**
 * The coherent public IP state for whichever address family an endpoint answers with: status, address and error from
 * one publication, shared by every Store in this page or process. Reading or
 * subscribing never sends a request; only `requestPublicIp()` does.
 */
export const publicIpAtom: ExternalAtom<PublicIpState> = externalAtom(
    publicIpSource("any"),
    {
        name: "@valdres/public-ip/publicIp",
    },
)
