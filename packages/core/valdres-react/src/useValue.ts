import { isPromiseLike, type State } from "valdres"
import { useSyncExternalStore } from "react"
import { useStore } from "./useStore"

export const useValue = (state: State) => {
    const store = useStore()
    const res = useSyncExternalStore(
        cb => store.sub(state, cb, false),
        () => store.get(state),
        () => store.get(state),
    )
    if (isPromiseLike(res)) {
        throw res
    } else {
        return res
    }
}
