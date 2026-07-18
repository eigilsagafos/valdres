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
    // Membership is store-local, while the family's identity cache is shared.
    // Releasing here could strand another store on this member while
    // family(...args) starts returning a different object for the same key.
    propagateDeletedAtoms(
        [atom],
        data,
        undefined,
        undefined,
        undefined,
        undefined,
        "delete",
    )
}
