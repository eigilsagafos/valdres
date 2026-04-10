import type { Atom, SetAtomValue, Store } from "valdres"
import { injectStore } from "./injectStore"

export const injectSetAtom = <V>(atom: Atom<V>, store?: Store) => {
    const selectedStore = store || injectStore()
    // @ts-ignore @ts-todo
    return (value: SetAtomValue<V>) => selectedStore.set(atom, value)
}
