import type { Atom, Store } from "valdres"
import { injectStore } from "./injectStore"

export const injectSetAtom = <V>(atom: Atom<V>, store?: Store) => {
    const selectedStore = store || injectStore()
    return (value: V) => selectedStore.set(atom, value)
}
