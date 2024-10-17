import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getAtomInitValue } from "./initAtom"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"

export const resetAtom = <V>(
    atom: Atom<V>,
    data: StoreData,
): V | Promise<V> => {
    let value = getAtomInitValue(atom, data)
    data.values.set(atom, value)
    if (!isPromiseLike(value)) {
        propagateUpdatedAtoms([atom], data)
    }
    return value
}
