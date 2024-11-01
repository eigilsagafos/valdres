import type { AtomDefaultValue } from "../types/AtomDefaultValue"
import type { AtomOnInit } from "../types/AtomOnInit"
import type { GlobalAtomResetSelfFunc } from "../types/GlobalAtomResetSelfFunc"
import type { GlobalAtomSetSelfFunc } from "../types/GlobalAtomSetSelfFunc"
import type { AtomOnSet } from "./../types/AtomOnSet"
import type { AtomOptions } from "./../types/AtomOptions"
import type { GlobalAtom } from "./../types/GlobalAtom"
import type { StoreData } from "./../types/StoreData"
import { getAtomInitValue } from "./initAtom"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setAtom } from "./setAtom"

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
    let initialized = false
    let onReset: (() => void) | void
    if (options.onSet)
        throw new Error("onSet on globalAtom is currently not supported")

    const onInit: AtomOnInit<Value> = (setSelf, data) => {
        if (!initialized) {
            if (value === defaultValue) {
                value = getAtomInitValue(atom, data)
            }
            setSelf(value as Value)
            initialized = true
            if (options.onInit) {
                onReset = options.onInit(newVal => {
                    setSelf(newVal)
                    value = newVal
                }, data)
            }
        } else {
            setSelf(value as Value)
        }
        stores.add(data)
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
    const resetSelf: GlobalAtomResetSelfFunc = () => {
        value = defaultValue
        initialized = false
        for (const store of stores) {
            if (store.stateDependencies.has(atom)) {
                throw new Error("TODO: Reset support for stateDependencies")
            }
            store.values.delete(atom)
            store.expiredValues.delete(atom)
            // TODO: Should we make a different propagate function for reset?
            // and also change reset to rather clear data unless it is found to be in use?
            propagateUpdatedAtoms([atom], store)
            stores.delete(store)
            onReset?.()
        }
    }

    const atom: GlobalAtom<Value> = {
        ...options,
        defaultValue,
        label: options?.label,
        onInit,
        onSet,
        setSelf,
        resetSelf,
        get currentValue() {
            return value
        },
    }
    return atom
}
