import { createPublicIpAtom } from "../lib/createPublicIpAtom"
import { isValidIp } from "../lib/isValidIp"
import { publicIpEndpointsAtom } from "./publicIpEndpointsAtom"
import { publicIpMaxAgeAtom } from "./publicIpMaxAgeAtom"

export const publicIpAtom = createPublicIpAtom(
    "@valdres/public-ip/publicIp",
    publicIpEndpointsAtom,
    publicIpMaxAgeAtom,
    isValidIp,
)
