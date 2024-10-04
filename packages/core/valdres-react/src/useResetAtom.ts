import { useCallback } from "react"
import { useStore } from "./useStore"
import type { Atom, Store } from "valdres"

export const useResetAtom = <V>(atom: Atom<V>, store?: Store): (() => void) => {
    const selectedStore = store || useStore()
    return useCallback(() => selectedStore.reset(atom), [atom, selectedStore])
}
