import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"
import { writeAtoms } from "./writeAtoms"

export const setAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    skipOnSet = false,
) => {
    const updatedAtoms = writeAtoms(pairs, data, initializedAtomsSet, skipOnSet)
    if (updatedAtoms.length > 0) {
        propagateAtomUpdate(updatedAtoms, data)
    }
}
