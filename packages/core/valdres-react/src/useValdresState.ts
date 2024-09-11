import type { State } from "../../valdres"
import { useSyncExternalStore } from "react"
import { useValdresStore } from "./useValdresStore"

export const useValdresState = <V>(
    state: State<V>,
): [V, (newVal: V | ((curr: V) => V)) => void] => {
    const store = useValdresStore()
    const result = useSyncExternalStore(
        cb => store.sub(state, cb),
        () => store.get(state),
    )
    return [result, (value: V | ((curr: V) => V)) => store.set(state, value)]
}
