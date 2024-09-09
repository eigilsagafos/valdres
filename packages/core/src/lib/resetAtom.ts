import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { initAtom } from "./initAtom"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"

export const resetAtom = <V>(
    atom: Atom<V>,
    data: StoreData,
): V | Promise<V> => {
    const res = initAtom(atom, data)
    if (!isPromiseLike(res)) {
        propagateUpdatedAtoms([atom], data)
    }
    return res
}
