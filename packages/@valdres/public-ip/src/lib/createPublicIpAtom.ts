import { atom } from "valdres"
import type { GlobalAtom } from "valdres"
import { fetchPublicIp } from "../utils/fetchPublicIp"
import { publicIpOnInit } from "./publicIpOnInit"

export const createPublicIpAtom = (
    name: string,
    endpointsAtom: GlobalAtom<string[]>,
    maxAgeAtom: GlobalAtom<number>,
    validate: (value: string) => boolean,
): GlobalAtom<Promise<string> | string> => {
    const ipAtom: GlobalAtom<Promise<string> | string> = atom<
        Promise<string> | string
    >(() => fetchPublicIp(endpointsAtom.getSelf(), validate), {
        global: true,
        name,
        maxAge: maxAgeAtom,
        onInit: (): (() => void) =>
            publicIpOnInit(ipAtom, endpointsAtom, validate),
    })
    return ipAtom
}
