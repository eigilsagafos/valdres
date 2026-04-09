import type { Atom, Store } from "valdres"
import { useStore } from "./useStore"

export const useResetAtom = <V>(
    atom: Atom<V>,
    store?: Store,
): (() => void) => {
    const resolvedStore = useStore(store)
    return () => resolvedStore.reset(atom)
}
