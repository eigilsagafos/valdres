import type { Atom, Store } from "valdres"
import { injectStore } from "./injectStore"

export const injectResetAtom = <V>(
    atom: Atom<V>,
    store?: Store,
): (() => void) => {
    const selectedStore = store || injectStore()
    return () => selectedStore.reset(atom)
}
