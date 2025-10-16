import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { propagateDeletedAtoms } from "./propagateUpdatedAtoms"

export const deleteFamilyAtom = <
    Value extends unknown,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    atom: AtomFamilyAtom<Value, Args>,
    data: StoreData,
) => {
    data.values.delete(atom)
    propagateDeletedAtoms([atom], data)
}
