import { useCallback } from "react"
import type { Atom, AtomUpdater, Store } from "valdres"
import { useSelectedStore } from "./lib/useSelectedStore"

export const useUpdateAtom = <Value>(
    atom: Atom<Value>,
    store?: Store,
): ((update: AtomUpdater<Value>) => void) => {
    const selectedStore = useSelectedStore(store)
    return useCallback(
        (update: AtomUpdater<Value>) => selectedStore.update(atom, update),
        [atom, selectedStore],
    )
}
