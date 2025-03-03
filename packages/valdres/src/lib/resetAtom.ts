import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getAtomInitValue } from "./initAtom"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"

export const resetAtom = <V>(
    atom: Atom<V>,
    data: StoreData,
): V | Promise<V> => {
    let value = getAtomInitValue(atom, data)
    setValueInData(atom, value, data)
    if (!isPromiseLike(value)) {
        propagateUpdatedAtoms([atom], data)
    }
    return value
}
