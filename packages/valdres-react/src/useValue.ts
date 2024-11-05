import { isPromiseLike, type State, type Store } from "valdres"
import { useCallback, useSyncExternalStore } from "react"
import { useStore } from "./useStore"

export const useValue = <V>(state: State<V>, store?: Store) => {
    const currentStore = store || useStore()
    const subscribe = useCallback(
        (cb: () => void) => {
            return currentStore.sub(state, cb, false)
        },
        [state, currentStore],
    )
    const getSnapshot = useCallback(
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
