import { useCallback } from "react"
import type { Atom, Store } from "valdres"
import { useSelectedStore } from "./lib/useSelectedStore"

export const useResetAtom = <Value>(
    atom: Atom<Value>,
    store?: Store,
): (() => void) => {
    const selectedStore = useSelectedStore(store)
    return useCallback(() => selectedStore.reset(atom), [atom, selectedStore])
}
