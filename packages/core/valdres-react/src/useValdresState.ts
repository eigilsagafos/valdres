import type { SetAtomValue, State } from "valdres"
import { useSyncExternalStore } from "react"
import { useValdresStore } from "./useValdresStore"
import { useSetValdresState } from "./useSetValdresState"

export const useValdresState = <V>(
    state: State<V>,
): [V | Promise<V>, (value: SetAtomValue<V>) => void] => {
    const store = useValdresStore()
    const result = useSyncExternalStore(
        cb => store.sub(state, cb, false),
        () => store.get(state),
    )
    return [result, useSetValdresState(state)]
}
