import { createPublicIpAtom } from "../lib/createPublicIpAtom"
import { isValidIpV4 } from "../lib/isValidIpV4"
import { publicIpV4EndpointsAtom } from "./publicIpV4EndpointsAtom"
import { publicIpMaxAgeAtom } from "./publicIpMaxAgeAtom"
import { publicIpStaleWhileRevalidateAtom } from "./publicIpStaleWhileRevalidateAtom"
import { publicIpStaleIfErrorAtom } from "./publicIpStaleIfErrorAtom"
import { publicIpV4StatusAtom } from "./publicIpV4StatusAtom"
import { publicIpV4ErrorAtom } from "./publicIpV4ErrorAtom"
import { publicIpV4ValueAtom } from "./publicIpV4ValueAtom"

export const publicIpV4Atom = createPublicIpAtom({
    name: "@valdres/public-ip/publicIpV4",
    endpointsAtom: publicIpV4EndpointsAtom,
    maxAgeAtom: publicIpMaxAgeAtom,
    staleWhileRevalidateAtom: publicIpStaleWhileRevalidateAtom,
    staleIfErrorAtom: publicIpStaleIfErrorAtom,
    validate: isValidIpV4,
    statusAtom: publicIpV4StatusAtom,
    errorAtom: publicIpV4ErrorAtom,
    valueAtom: publicIpV4ValueAtom,
})
