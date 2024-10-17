import { setAtom } from "./setAtom"
import type { GlobalAtom } from "./../types/GlobalAtom"
import type { AtomOnSet } from "./../types/AtomOnSet"
import type { AtomOptions } from "./../types/AtomOptions"
import type { StoreData } from "./../types/StoreData"
import type { AtomDefaultValue } from "../types/AtomDefaultValue"
import type { GlobalAtomSetSelfFunc } from "../types/GlobalAtomSetSelfFunc"
import type { AtomOnInit } from "../types/AtomOnInit"

const getFirstItemInSet = <T>(set: Set<T>): T => {
    for (let item of set) {
        return item
    }
    throw new Error("Non Empty Set")
}

export const globalAtom = <Value = any>(
    defaultValue: AtomDefaultValue<Value>,
    options: AtomOptions<Value>,
) => {
    const stores = new Set<StoreData>()
    let value: AtomDefaultValue<Value> = defaultValue
    if (options.onSet)
        throw new Error("onSet on globalAtom is currently not supported")
    if (options.onInit)
        throw new Error("onInit on globalAtom is currently not supported")

    const onInit: AtomOnInit<Value> = (setSelf, store) => {
        setSelf(value as Value)
        stores.add(store)
    }

    const onSet: AtomOnSet<Value> = (newValue, currentStore) => {
        value = newValue
        if (stores.size > 1) {
            for (const store of stores) {
                if (store.id !== currentStore.id) {
                    setAtom(atom, value, store, true)
                }
            }
        }
    }

    const setSelf: GlobalAtomSetSelfFunc<Value> = newValue => {
        value = newValue
        if (stores.size > 0) {
            getFirstItemInSet(stores)
            const store = getFirstItemInSet(stores)
            setAtom(atom, newValue, store)
        }
    }

    const atom: GlobalAtom<Value> = {
        ...options,
        defaultValue,
        label: options?.label,
        onInit,
        onSet,
        setSelf,
    }
    return atom
}
