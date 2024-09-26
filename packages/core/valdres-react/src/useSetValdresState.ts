import type { Atom, SetAtomValue } from "valdres"
import { useValdresStore } from "./useValdresStore"
import { useCallback } from "react"

export const useSetValdresState = <V>(atom: Atom<V>) => {
    const store = useValdresStore()
    return useCallback(
        (value: SetAtomValue<V>) => store.set(atom, value),
        [store],
    )
}
