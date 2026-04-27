import { createPublicIpAtom } from "../lib/createPublicIpAtom"
import { isValidIpV6 } from "../lib/isValidIpV6"
import { publicIpV6EndpointsAtom } from "./publicIpV6EndpointsAtom"
import { publicIpMaxAgeAtom } from "./publicIpMaxAgeAtom"
import { publicIpStaleWhileRevalidateAtom } from "./publicIpStaleWhileRevalidateAtom"
import { publicIpStaleIfErrorAtom } from "./publicIpStaleIfErrorAtom"
import { publicIpV6StatusAtom } from "./publicIpV6StatusAtom"
import { publicIpV6ErrorAtom } from "./publicIpV6ErrorAtom"
import { publicIpV6ValueAtom } from "./publicIpV6ValueAtom"

export const publicIpV6Atom = createPublicIpAtom({
    name: "@valdres/public-ip/publicIpV6",
    endpointsAtom: publicIpV6EndpointsAtom,
    maxAgeAtom: publicIpMaxAgeAtom,
    staleWhileRevalidateAtom: publicIpStaleWhileRevalidateAtom,
    staleIfErrorAtom: publicIpStaleIfErrorAtom,
    validate: isValidIpV6,
    statusAtom: publicIpV6StatusAtom,
    errorAtom: publicIpV6ErrorAtom,
    valueAtom: publicIpV6ValueAtom,
})
