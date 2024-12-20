import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { getState } from "./getState"
import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"

export const setAtoms = (pairs: Map<Atom<any>, any>, data: StoreData) => {
    const updatedAtoms = []
    for (let [atom, value] of pairs) {
        const currentValue = getState(atom, data)
        if (!atom.equal(currentValue, value)) {
            updatedAtoms.push(atom)
            if (atom.onSet) atom.onSet(value, data)
            data.values.set(atom, value)
        }
    }
    propagateUpdatedAtoms(updatedAtoms, data)
}
