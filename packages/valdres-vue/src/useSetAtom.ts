import type { Atom, SetAtomValue, Store } from "valdres"
import { useStore } from "./useStore"

export const useSetAtom = <V>(atom: Atom<V>, store?: Store) => {
    const selectedStore = store || useStore()
    // @ts-ignore @ts-todo
    return (value: SetAtomValue<V>) => selectedStore.set(atom, value)
}
