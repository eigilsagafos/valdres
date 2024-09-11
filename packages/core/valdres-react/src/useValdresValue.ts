import { isPromiseLike, type State } from "../../valdres"
import { useSyncExternalStore } from "react"
import { useValdresStore } from "./useValdresStore"

export const useValdresValue = (state: State) => {
    const store = useValdresStore()
    const res = useSyncExternalStore(
        cb => store.sub(state, cb),
        () => store.get(state),
    )
    if (isPromiseLike(res)) {
        throw res
    } else {
        return res
    }
}
