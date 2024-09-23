import { isPromiseLike, type State } from "valdres"
import { useSyncExternalStore } from "react"
import { useValdresStore } from "./useValdresStore"

export const useValdresValueWithDefault = (state: State, defaultValue: any) => {
    const store = useValdresStore()
    const res = useSyncExternalStore(
        cb => store.sub(state, cb, false),
        () => store.getWithDefault(state, defaultValue),
    )
    if (isPromiseLike(res)) {
        throw res
    } else {
        return res
    }
}
