import { setAtom } from "./setAtom"
import type { Atom } from "./../types/Atom"
import type { AtomOnSet } from "./../types/AtomOnSet"
import type { AtomOptions } from "./../types/AtomOptions"
import type { StoreData } from "./../types/StoreData"

export const globalAtom = <Value = any, FamilyKey = undefined>(
    defaultValue: Value | (() => Value | Promise<Value>),
    options: AtomOptions<Value>,
) => {
    const stores = new Set<StoreData>()
    let value = defaultValue
    const onSet: AtomOnSet<Value> = (newValue, currentStore) => {
        value = newValue
        if (stores.size > 1) {
            for (const store of stores) {
                if (store.id !== currentStore.id) {
                    setAtom(newAtom, value, store, true)
                }
            }
        }
    }
    const newAtom: Atom<Value> = {
        defaultValue,
        ...options,
        onInit: (setSelf, store) => {
            // @ts-ignore @ts-todo
            setSelf(value)
            stores.add(store)
        },
        onSet,
        label: options?.label,
    }

    return newAtom
}
