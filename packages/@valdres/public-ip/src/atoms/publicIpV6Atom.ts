import { createPublicIpAtom } from "../lib/createPublicIpAtom"
import { publicIpV6EndpointsAtom } from "./publicIpV6EndpointsAtom"
import { publicIpMaxAgeAtom } from "./publicIpMaxAgeAtom"

export const publicIpV6Atom = createPublicIpAtom(
    "@valdres/public-ip/publicIpV6",
    publicIpV6EndpointsAtom,
    publicIpMaxAgeAtom,
)
