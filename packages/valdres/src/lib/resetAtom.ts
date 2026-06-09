import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getAtomInitValue } from "./initAtom"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"

export const resetAtom = <V>(
    atom: Atom<V>,
    data: StoreData,
): V | Promise<V> => {
    const initializedAtomsSet = new Set<Atom>()
    let value = getAtomInitValue(atom, data, initializedAtomsSet)
    setValueInData(atom, value, data)
    if (!isPromiseLike(value)) {
        propagateAtomUpdate([atom], data, false, undefined, "reset")
    }
    if (initializedAtomsSet.size > 0) {
        throw new Error("Todo - propagateAtomUpdate on reset")
    }
    return value
}
