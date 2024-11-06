import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"

export const setAtom = <Value = any>(
    atom: Atom<Value>,
    newValue: Value,
    data: StoreData,
    skipOnSet = false,
) => {
    const currentValue = getState(atom, data)
    if (typeof newValue === "function") {
        newValue = newValue(currentValue)
        if (isPromiseLike(newValue) || isPromiseLike(currentValue))
            throw new Error("Todo, how should we handle this?")
        // newValue = newVal
    }
    if (atom.equal(currentValue, newValue)) return
    data.values.set(atom, newValue)
    if (atom.onSet && !skipOnSet) atom.onSet(newValue, data)
    // @ts-ignore
    if (currentValue?.__isEmptyAtomPromise__) {
        // @ts-ignore
        currentValue.__resolveEmptyAtomPromise__(newValue)
    }

    propagateUpdatedAtoms([atom], data)
}
