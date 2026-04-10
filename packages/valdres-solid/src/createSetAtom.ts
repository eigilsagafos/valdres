import type { Atom, SetAtomValue, Store } from "valdres"
import { useStore } from "./useStore"

export const createSetAtom = <V>(atom: Atom<V>, store?: Store) => {
    const currentStore = store || useStore()
    // @ts-ignore @ts-todo
    return (value: SetAtomValue<V>) => currentStore.set(atom, value)
}
