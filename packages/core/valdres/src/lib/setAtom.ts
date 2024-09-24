import equal from "fast-deep-equal"
import { isPromiseLike } from "../utils/isPromiseLike"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { getState } from "./getState"

export const setAtom = <V>(atom: Atom<V>, newValue: V, data: StoreData) => {
    const currentValue = getState(atom, data)
    if (typeof newValue === "function") {
        newValue = newValue(currentValue)
        if (isPromiseLike(newValue) || isPromiseLike(currentValue))
            throw new Error("Todo, how should we handle this?")
        // newValue = newVal
    }
    if (equal(currentValue, newValue)) return

    data.values.set(atom, newValue)
    // @ts-ignore
    if (currentValue?.__isEmptyAtomPromise__) {
        // @ts-ignore
        currentValue.__resolveEmptyAtomPromise__(newValue)
    }

    propagateUpdatedAtoms([atom], data)
}
