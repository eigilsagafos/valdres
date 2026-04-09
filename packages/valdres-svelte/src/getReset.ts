import type { Atom, Store } from "valdres"
import { getStore } from "./getStore"

export const getReset = <V>(
    atom: Atom<V>,
    store?: Store,
): (() => void) => {
    const resolvedStore = getStore(store)
    return () => resolvedStore.reset(atom)
}
