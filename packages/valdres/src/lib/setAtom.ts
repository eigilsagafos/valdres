import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { isFunction } from "./isFunction"

export const setAtom = <Value = any>(
    atom: Atom<Value>,
    newValue: Value | ((currentValue: Value) => Value),
    data: StoreData,
    skipOnSet = false,
) => {
    const currentValue = getState(atom, data)
    if (isFunction(newValue)) {
        newValue = newValue(currentValue)
        if (isPromiseLike(newValue) || isPromiseLike(currentValue))
            throw new Error("Todo, how should we handle this?")
    }
    if (atom.equal(currentValue, newValue)) return newValue
    data.values.set(atom, newValue)
    if (atom.onSet && !skipOnSet) atom.onSet(newValue, data)
    // @ts-ignore
    if (currentValue?.__isEmptyAtomPromise__) {
        // @ts-ignore
        currentValue.__resolveEmptyAtomPromise__(newValue)
    }

    propagateUpdatedAtoms([atom], data)
    return newValue
}
