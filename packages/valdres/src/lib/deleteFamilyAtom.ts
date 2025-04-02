import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"

export const deleteFamilyAtom = <
    Value extends unknown,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    atom: AtomFamilyAtom<Value, Args>,
    data: StoreData,
) => {
    const array = data.values.get(atom.family) as AtomFamilyAtom<Value, Args>[]
    const index = array.indexOf(atom)
    const newArray: AtomFamilyAtom<Value, Args>[] = [
        ...array.slice(0, index),
        ...array.slice(index + 1),
    ]
    data.values.delete(atom)
    // TODO: Update propagation logic to optimize for when we delete
    propagateUpdatedAtoms([atom], data)
    setValueInData(atom.family, newArray, data)
    propagateUpdatedAtoms([atom.family], data)
}
