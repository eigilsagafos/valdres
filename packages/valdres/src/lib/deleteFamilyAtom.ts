import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import { clearSupersededAsyncAtomCoordinator } from "./asyncAtomCoordinatorRegistry"
import { runCommitPlan } from "./commitEngine"
import { createCommitErrors } from "./commitErrors"
import { createCommitPlan, deleteSettlement, NO_ON_SETS } from "./commitPlans"
import { settleDeletedCommit } from "./propagateUpdatedAtoms"
import { noteStateValueChanged } from "./stateRevisions"

export const deleteFamilyAtom = <
    Value extends unknown,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    atom: AtomFamilyAtom<Value, Args>,
    data: StoreData,
) => {
    clearSupersededAsyncAtomCoordinator(atom, data)
    if (data.values.delete(atom)) {
        noteStateValueChanged(atom, data)
    }
    // Membership is store-local, while the family's identity cache is shared.
    // Releasing here could strand another store on this member while
    // family(...args) starts returning a different object for the same key.
    runCommitPlan(
        createCommitPlan(
            data,
            deleteSettlement(data, [atom], settleDeletedCommit),
            NO_ON_SETS,
            createCommitErrors(),
            "delete",
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            false,
        ),
    )
}
