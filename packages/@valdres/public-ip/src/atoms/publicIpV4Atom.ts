import { createPublicIpAtom } from "../lib/createPublicIpAtom"
import { publicIpV4EndpointsAtom } from "./publicIpV4EndpointsAtom"
import { publicIpMaxAgeAtom } from "./publicIpMaxAgeAtom"

export const publicIpV4Atom = createPublicIpAtom(
    "@valdres/public-ip/publicIpV4",
    publicIpV4EndpointsAtom,
    publicIpMaxAgeAtom,
)
