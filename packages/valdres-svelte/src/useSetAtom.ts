import type { Atom, SetAtomValue, Store } from "valdres"
import { useStore } from "./useStore"

export const useSetAtom = <V>(
    atom: Atom<V>,
    store?: Store,
): ((value: SetAtomValue<V>) => void) => {
    const resolvedStore = useStore(store)
    return (value: SetAtomValue<V>) => resolvedStore.set(atom, value)
}
