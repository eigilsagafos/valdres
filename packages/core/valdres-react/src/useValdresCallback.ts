import { useCallback, type DependencyList } from "react"
import { useValdresStore } from "./useValdresStore"
import type { GetValue, SetAtom } from "valdres"

export const useValdresCallback = <T extends Function>(
    callback: (set: SetAtom, get: GetValue) => T,
    deps: DependencyList,
) => {
    const store = useValdresStore()
    return useCallback((...args: any[]) => {
        store.txn((set, get) => {
            callback(set, get)(...args)
        })
    }, deps)
}
