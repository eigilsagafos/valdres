import { atom } from "valdres"
import type { GlobalAtom } from "valdres"
import { fetchPublicIp } from "../utils/fetchPublicIp"
import { subscribe } from "./subscribe"
import type { PublicIpStatus } from "../types/PublicIpStatus"

type Params = {
    name: string
    endpointsAtom: GlobalAtom<string[]>
    maxAgeAtom: GlobalAtom<number>
    staleWhileRevalidateAtom: GlobalAtom<number>
    staleIfErrorAtom: GlobalAtom<number>
    validate: (value: string) => boolean
    statusAtom: GlobalAtom<PublicIpStatus>
    errorAtom: GlobalAtom<Error | null>
    valueAtom: GlobalAtom<string | null>
}

export const createPublicIpAtom = ({
    name,
    endpointsAtom,
    maxAgeAtom,
    staleWhileRevalidateAtom,
    staleIfErrorAtom,
    validate,
    statusAtom,
    errorAtom,
    valueAtom,
}: Params): GlobalAtom<Promise<string> | string> => {
    const runFetch = (): Promise<string> => {
        if (
            staleWhileRevalidateAtom.getSelf() === 0 &&
            valueAtom.getSelf() !== null
        ) {
            valueAtom.setSelf(null)
        }
        statusAtom.setSelf(
            valueAtom.getSelf() === null ? "loading" : "revalidating",
        )
        const promise = fetchPublicIp(endpointsAtom.getSelf(), validate)
        promise.then(
            value => {
                valueAtom.setSelf(value)
                errorAtom.setSelf(null)
                statusAtom.setSelf("ok")
            },
            err => {
                statusAtom.setSelf("error")
                errorAtom.setSelf(
                    err instanceof Error ? err : new Error(String(err)),
                )
            },
        )
        return promise
    }

    const ipAtom: GlobalAtom<Promise<string> | string> = atom<
        Promise<string> | string
    >(runFetch, {
        global: true,
        name,
        maxAge: maxAgeAtom,
        staleWhileRevalidate: staleWhileRevalidateAtom,
        staleIfError: staleIfErrorAtom,
        onMount: (): (() => void) => subscribe(ipAtom, runFetch),
    })

    return ipAtom
}
