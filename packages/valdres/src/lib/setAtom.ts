import equal from "fast-deep-equal"
import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { createStoreData } from "./createStoreData"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"

const getScopedData = (data: StoreData, scopeId: string) => {
    if (scopeId in data.scopes) return data.scopes[scopeId]
    data.scopes[scopeId] = createStoreData(`${data.id}:${scopeId}`, data)
    return data.scopes[scopeId]
}

export const setAtom = <Value = any>(
    atom: Atom<Value>,
    newValue: Value,
    data: StoreData,
    scopeId: string | undefined = undefined,
    skipOnSet = false,
) => {
    const currentValue = getState(atom, data, scopeId)
    if (typeof newValue === "function") {
        newValue = newValue(currentValue)
        if (isPromiseLike(newValue) || isPromiseLike(currentValue))
            throw new Error("Todo, how should we handle this?")
        // newValue = newVal
    }
    if (equal(currentValue, newValue)) return
    if (scopeId) data = getScopedData(data, scopeId)
    data.values.set(atom, newValue)
    if (atom.onSet && !skipOnSet) atom.onSet(newValue, data)
    // @ts-ignore
    if (currentValue?.__isEmptyAtomPromise__) {
        // @ts-ignore
        currentValue.__resolveEmptyAtomPromise__(newValue)
    }

    propagateUpdatedAtoms([atom], data)
}
