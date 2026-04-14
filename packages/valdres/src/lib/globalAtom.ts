import { equal } from "./equal"
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
        if (atom.maxAgeInterval) {
            atom.maxAgeInterval.cleanup()
            atom.maxAgeInterval.refCount = 0
            atom.maxAgeInterval = undefined
        }
        // Snapshot to avoid mutating during iteration
        const snapshot = [...stores]
        let firstError: unknown
        for (const store of snapshot) {
            if (store.stateDependencies.has(atom)) {
                throw new Error("TODO: Reset support for stateDependencies")
            }
            store.values.delete(atom)
            try {
                propagateUpdatedAtoms([atom], store)
            } catch (e) {
                if (!firstError) firstError = e
            }
        }
        stores.clear()
        onReset?.()
        if (firstError) throw firstError
    }

    const detach = (storeData: StoreData) => {
        stores.delete(storeData)
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
        detach,
        get stores() {
            return stores
        },
        maxAgeInterval: undefined,
    }
    return atom
}
