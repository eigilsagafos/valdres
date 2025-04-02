import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { getState } from "./getState"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"

export const setAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
) => {
    const updatedAtoms = []
    for (let [atom, value] of pairs) {
        const currentValue = getState(atom, data, initializedAtomsSet)
        if (!atom.equal(currentValue, value)) {
            updatedAtoms.push(atom)
            value = setValueInData(atom, value, data)
            if (atom.onSet) atom.onSet(value, data)
        }
    }
    const result = new Set([...updatedAtoms, ...initializedAtomsSet])
    if (result.size > 0) {
        propagateUpdatedAtoms([...result], data)
    }
}
