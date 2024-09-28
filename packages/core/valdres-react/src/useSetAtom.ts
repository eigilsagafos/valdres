import type { Atom, SetAtomValue } from "valdres"
import { useStore } from "./useStore"
import { useCallback } from "react"

export const useSetAtom = <V>(atom: Atom<V>) => {
    const store = useStore()
    return useCallback(
        (value: SetAtomValue<V>) => store.set(atom, value),
        [store],
    )
}
