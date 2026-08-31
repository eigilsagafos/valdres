import { useCallback } from "react"
import type { Atom, Store } from "valdres"
import { useSelectedStore } from "./lib/useSelectedStore"

export const useSetAtom = <Value>(
    atom: Atom<Value>,
    store?: Store,
): ((value: Value) => void) => {
    const selectedStore = useSelectedStore(store)
    return useCallback(
        (value: Value) => selectedStore.set(atom, value),
        [atom, selectedStore],
    )
}
