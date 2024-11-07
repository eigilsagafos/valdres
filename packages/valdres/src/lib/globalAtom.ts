import equal from "fast-deep-equal/es6"
import type { AtomDefaultValue } from "../types/AtomDefaultValue"
import type { AtomOnInit } from "../types/AtomOnInit"
import type { GlobalAtomResetSelfFunc } from "../types/GlobalAtomResetSelfFunc"
import type { GlobalAtomSetSelfFunc } from "../types/GlobalAtomSetSelfFunc"
import type { AtomOnSet } from "./../types/AtomOnSet"
import type { AtomOptions } from "./../types/AtomOptions"
import type { GlobalAtom } from "./../types/GlobalAtom"
import type { StoreData } from "./../types/StoreData"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setAtom } from "./setAtom"
import { globalStore } from "../globalStore"

export const globalAtom = <Value = unknown>(
    defaultValue: AtomDefaultValue<Value>,
    options: AtomOptions<Value>,
) => {
    const stores = new Set<StoreData>()
    let value: Value | undefined
    let initialized = false
    let onReset: (() => void) | void
    if (options.onSet)
        throw new Error("onSet on globalAtom is currently not supported")

    const onInit: AtomOnInit<Value> = (setSelf, data) => {
        setSelf(globalStore.get(atom))
        if (!initialized && options.onInit) {
            onReset = options.onInit(newVal => {
                setSelf(newVal)
                value = newVal
            }, data)
            initialized = true
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

    const getSelf = () => globalStore.get(atom)

    const setSelf: GlobalAtomSetSelfFunc<Value> = newValue =>
        globalStore.set(atom, newValue)

    const resetSelf: GlobalAtomResetSelfFunc = () => {
        value = undefined
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
        equal,
        ...options,
        defaultValue,
        name: options?.name,
        onInit,
        onSet,
        setSelf,
        getSelf,
        resetSelf,
        get stores() {
            return stores
        },
    }
    return atom
}
