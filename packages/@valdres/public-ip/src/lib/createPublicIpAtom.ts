import { atom } from "valdres"
import type { GlobalAtom } from "valdres"
import { fetchPublicIp } from "../utils/fetchPublicIp"
import { publicIpOnInit } from "./publicIpOnInit"

export const createPublicIpAtom = (
    name: string,
    endpointsAtom: GlobalAtom<string[]>,
    maxAgeAtom: GlobalAtom<number>,
): GlobalAtom<Promise<string> | string> => {
    const ipAtom = atom<Promise<string> | string>(
        () => fetchPublicIp(endpointsAtom.getSelf()),
        {
            global: true,
            name,
            maxAge: maxAgeAtom,
            onInit: () => publicIpOnInit(ipAtom, endpointsAtom),
        },
    )
    return ipAtom
}
