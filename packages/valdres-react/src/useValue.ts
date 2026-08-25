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
    // Committed read, not `currentStore.get`: on a batchUpdates store the
    // latter answers from the open batch, so the snapshot can move without a
    // subscriber callback — which useSyncExternalStore diagnoses as tearing and
    // repairs with forceStoreRerender on every commit. See
    // storeAdapter.committedGet.
    const getSnapshot = useCallback(
        // @ts-ignore
        () => storeAdapter.committedGet(currentStore, state),
        [state, currentStore],
    )
    const res = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    if (isPromiseLike(res)) {
        throw res
    } else {
        return res
    }
}
