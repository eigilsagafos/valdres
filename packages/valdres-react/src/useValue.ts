import { isPromiseLike, type Atom, type Selector, type Store } from "valdres"
import { storeAdapter } from "valdres/adapter-internals/v1"
import { useCallback, useSyncExternalStore } from "react"
import { useStore } from "./useStore"

export const useValue = <Value extends any = any>(
    state: Atom<Value> | Selector<Value>,
    store?: Store,
) => {
    const currentStore = store || useStore()
    const subscribe = useCallback(
        // @ts-ignore
        (cb: () => void) => currentStore.sub(state, cb, false),
        [state, currentStore],
    )
    const getSnapshot = useCallback(
        // @ts-ignore
        () =>
            // Keep compatibility with an older valdres runtime allowed by this
            // package's dependency range; the capability was added incrementally.
            typeof storeAdapter.getForSubscription === "function"
                ? storeAdapter.getForSubscription(currentStore, state)
                : currentStore.get(state),
        [state, currentStore],
    )
    const res = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    if (isPromiseLike(res)) {
        throw res
    } else {
        return res
    }
}
