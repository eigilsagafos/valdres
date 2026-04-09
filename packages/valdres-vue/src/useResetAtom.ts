import type { Atom, Store } from "valdres"
import { useStore } from "./useStore"

export const useResetAtom = <V>(atom: Atom<V>, store?: Store): (() => void) => {
    const selectedStore = store || useStore()
    return () => selectedStore.reset(atom)
}
