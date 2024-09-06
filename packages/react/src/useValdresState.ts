import type { State } from "@valdres/core"
import { useSyncExternalStore } from "react"
import { useValdresStore } from "./useValdresStore"

export const useValdresState = <V>(state: State<V>) => {
    const store = useValdresStore()
    const result = useSyncExternalStore(
        cb => store.sub(state, cb),
        () => store.get(state),
    )
    return [result, (value: V) => store.set(state, value)]
}
