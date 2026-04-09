import type { Atom, SetAtomValue, Store } from "valdres"
import { getStore } from "./getStore"

export const getSetter = <V>(
    atom: Atom<V>,
    store?: Store,
): ((value: SetAtomValue<V>) => void) => {
    const resolvedStore = getStore(store)
    return (value: SetAtomValue<V>) => resolvedStore.set(atom, value)
}
