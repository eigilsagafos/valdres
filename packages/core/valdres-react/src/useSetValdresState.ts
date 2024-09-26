import type { SetAtomValue, State } from "valdres"
import { useValdresStore } from "./useValdresStore"
import { useCallback } from "react"

export const useSetValdresState = <V>(state: State<V>) => {
    const store = useValdresStore()
    return useCallback(
        (value: SetAtomValue<V>) => store.set(state, value),
        [store],
    )
}
