import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"

export const setAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
) => {
    const updatedAtoms: Atom[] = []
    for (let [atom, value] of pairs) {
        const currentValue = getState(atom, data, initializedAtomsSet)
        const areEqual = isPromiseLike(currentValue) || isPromiseLike(value)
            ? currentValue === value
            : atom.equal(currentValue, value)
        if (!areEqual) {
            updatedAtoms.push(atom)
            value = setValueInData(atom, value, data)
            if (atom.onSet) atom.onSet(value, data)
        } else {
            // We do this to ensure that if an atom was set in a scoped transaction but was the same we still override it in that scope
            setValueInData(atom, value, data)
        }
    }
    // Merge updatedAtoms and initializedAtomsSet without extra Set+spread
    if (initializedAtomsSet.size > 0) {
        for (const atom of initializedAtomsSet) {
            updatedAtoms.push(atom)
        }
    }
    if (updatedAtoms.length > 0) {
        propagateUpdatedAtoms(updatedAtoms, data)
    }
}
