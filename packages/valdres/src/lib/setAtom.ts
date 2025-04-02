import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { isFunction } from "./isFunction"
import { setValueInData } from "./setValueInData"

export const setAtom = <Value = any>(
    atom: Atom<Value>,
    newValue: Value | ((currentValue: Value) => Value),
    data: StoreData,
    skipOnSet = false,
) => {
    const initializedAtomsSet = new Set<Atom>()
    const currentValue = getState(atom, data, initializedAtomsSet)
    if (isFunction(newValue)) {
        newValue = newValue(currentValue)
        if (isPromiseLike(newValue) || isPromiseLike(currentValue))
            throw new Error("Todo, how should we handle this?")
    }
    if (atom.equal(currentValue, newValue)) return newValue
    newValue = setValueInData(atom, newValue, data)
    if (atom.onSet && !skipOnSet) atom.onSet(newValue, data)
    // @ts-ignore
    if (currentValue?.__isEmptyAtomPromise__) {
        // @ts-ignore
        currentValue.__resolveEmptyAtomPromise__(newValue)
    }
    if (initializedAtomsSet.size > 0) {
        // @ts-ignore
        const all = new Set<Atom>([...initializedAtomsSet, atom])
        propagateUpdatedAtoms([...all], data)
    } else {
        propagateUpdatedAtoms([atom], data)
    }
    return newValue
}
