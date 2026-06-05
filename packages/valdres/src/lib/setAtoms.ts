import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import type { ChangeReport } from "./notifyChangeListeners"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"
import { writeAtoms } from "./writeAtoms"

export const setAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    skipOnSet = false,
    report?: ChangeReport,
) => {
    const updatedAtoms = writeAtoms(pairs, data, initializedAtomsSet, skipOnSet)
    if (updatedAtoms.length > 0) {
        propagateAtomUpdate(updatedAtoms, data, false, undefined, report)
    }
}
