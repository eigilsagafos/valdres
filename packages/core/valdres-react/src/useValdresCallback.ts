import { useCallback, type DependencyList } from "react"
import { useStore } from "./useStore"
import type { GetValue, SetAtom } from "valdres"

export const useValdresCallback = <T extends Function>(
    callback: (set: SetAtom<any>, get: GetValue) => T,
    deps: DependencyList,
) => {
    const store = useStore()
    return useCallback((...args: any[]) => {
        store.txn((set, get) => {
            callback(set, get)(...args)
        })
    }, deps)
}
