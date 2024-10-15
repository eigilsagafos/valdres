import type { CallbackInterface } from "recoil"
import { useStore, useValdresCallback } from "valdres-react"

export const useRecoilCallback = <Args extends ReadonlyArray<unknown>, Return>(
    callback: (args: CallbackInterface) => (args: Args) => Return,
    deps = [],
) => {
    const store = useStore()
    return useValdresCallback(
        (set, _get, reset) => (args: Args) => {
            return callback({
                set,
                reset,
                refresh: () => {
                    throw new Error("Not implemented")
                },
                transact_UNSTABLE: () => {
                    throw new Error("Not implemented")
                },
                snapshot: {
                    getLoadable: state => {
                        return {
                            contents: store.get(state as any),
                        } as any
                    },
                    getID: () => {
                        throw new Error("Not implemented")
                    },
                    getPromise: () => {
                        throw new Error("Not implemented")
                    },
                    getNodes_UNSTABLE: () => {
                        throw new Error("Not implemented")
                    },
                    getInfo_UNSTABLE: () => {
                        throw new Error("Not implemented")
                    },
                    map: undefined as any,
                    asyncMap: undefined as any,
                    retain: undefined as any,
                    isRetained: undefined as any,
                },
                gotoSnapshot: () => {},
            } as CallbackInterface)(args)
        },
        [...deps, store],
    )
}
