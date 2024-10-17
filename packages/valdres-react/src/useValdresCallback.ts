import { useCallback, type DependencyList } from "react"
import { useStore } from "./useStore"
import type { GetValue, SetAtom, Store } from "valdres"

export const useValdresCallback = <T extends Function>(
    callback: (
        set: SetAtom<any>,
        get: GetValue,
        reset: (atom: any) => void,
    ) => T,
    deps: DependencyList,
) => {
    const store = useStore()
    return useCallback((...args: any[]) => {
        let res
        store.txn((set, get, reset) => {
            res = callback(set, get, reset)(...args)
        })
        return res
    }, deps)
}
