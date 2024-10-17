import type { Atom, SetAtomValue, Store } from "valdres"
import { useStore } from "./useStore"
import { useCallback } from "react"

export const useSetAtom = <V>(atom: Atom<V>, store?: Store) => {
    const selectedStore = store || useStore()
    return useCallback(
        // @ts-ignore @ts-todo
        (value: SetAtomValue<V>) => selectedStore.set(atom, value),
        [selectedStore],
    )
}
