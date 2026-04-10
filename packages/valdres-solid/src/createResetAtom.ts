import type { Atom, Store } from "valdres"
import { useStore } from "./useStore"

export const createResetAtom = <V>(atom: Atom<V>, store?: Store): (() => void) => {
    const currentStore = store || useStore()
    return () => currentStore.reset(atom)
}
