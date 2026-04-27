import { createPublicIpAtom } from "../lib/createPublicIpAtom"
import { isValidIp } from "../lib/isValidIp"
import { publicIpEndpointsAtom } from "./publicIpEndpointsAtom"
import { publicIpMaxAgeAtom } from "./publicIpMaxAgeAtom"
import { publicIpStaleWhileRevalidateAtom } from "./publicIpStaleWhileRevalidateAtom"
import { publicIpStaleIfErrorAtom } from "./publicIpStaleIfErrorAtom"
import { publicIpStatusAtom } from "./publicIpStatusAtom"
import { publicIpErrorAtom } from "./publicIpErrorAtom"
import { publicIpValueAtom } from "./publicIpValueAtom"

export const publicIpAtom = createPublicIpAtom({
    name: "@valdres/public-ip/publicIp",
    endpointsAtom: publicIpEndpointsAtom,
    maxAgeAtom: publicIpMaxAgeAtom,
    staleWhileRevalidateAtom: publicIpStaleWhileRevalidateAtom,
    staleIfErrorAtom: publicIpStaleIfErrorAtom,
    validate: isValidIp,
    statusAtom: publicIpStatusAtom,
    errorAtom: publicIpErrorAtom,
    valueAtom: publicIpValueAtom,
})
