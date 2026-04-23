import { createPublicIpAtom } from "../lib/createPublicIpAtom"
import { isValidIpV4 } from "../lib/isValidIpV4"
import { publicIpV4EndpointsAtom } from "./publicIpV4EndpointsAtom"
import { publicIpMaxAgeAtom } from "./publicIpMaxAgeAtom"

export const publicIpV4Atom = createPublicIpAtom(
    "@valdres/public-ip/publicIpV4",
    publicIpV4EndpointsAtom,
    publicIpMaxAgeAtom,
    isValidIpV4,
)
