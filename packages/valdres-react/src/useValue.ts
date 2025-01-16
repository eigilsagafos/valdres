import { isPromiseLike, type State, type Store } from "valdres"
import { useCallback, useSyncExternalStore } from "react"
import { useStore } from "./useStore"

export const useValue = <K, V>(state: State<K, V>, store?: Store) => {
    const currentStore = store || useStore()
    const subscribe = useCallback(
        // @ts-ignore
        (cb: (arg?: K) => void) => currentStore.sub(state, cb, false),
        [state, currentStore],
    )
    const getSnapshot = useCallback(
        // @ts-ignore
        () => currentStore.get(state),
        [state, currentStore],
    )
    const res = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    if (isPromiseLike(res)) {
        throw res
    } else {
        return res
    }
}
