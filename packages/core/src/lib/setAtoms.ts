import equal from "fast-deep-equal/es6"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { getState } from "./getState"
import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"

export const setAtoms = (pairs: Map<Atom<any>, any>, data: StoreData) => {
    const updatedAtoms = []
    for (let [atom, value] of pairs) {
        const currentValue = getState(atom, data)
        if (!equal(currentValue, value)) {
            updatedAtoms.push(atom)
            data.values.set(atom, value)
        }
    }
    propagateUpdatedAtoms(updatedAtoms, data)
}
