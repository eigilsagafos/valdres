import { isPromiseLike, type State, type Store } from "valdres"
import { useSyncExternalStore } from "react"
import { useStore } from "./useStore"

export const useValue = (state: State, store?: Store) => {
    const currentStore = store || useStore()
    const res = useSyncExternalStore(
        cb => currentStore.sub(state, cb, false),
        // @ts-ignore @ts-todo
        () => currentStore.get(state),
        // @ts-ignore @ts-todo
        () => currentStore.get(state),
    )
    if (isPromiseLike(res)) {
        throw res
    } else {
        return res
    }
}
