import type { CommitErrors } from "../lib/commitErrors"
import type { ChangeReport } from "../lib/notifyChangeListeners"
import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { StoreData } from "./StoreData"

/**
 * Settlement (phases 4–7) of a single-store transaction commit that includes
 * cleanup mutations: one deferred-notification pass over the updated atoms,
 * the deleted family members, and the unset atoms, in that order, firing every
 * collected subscriber once at the end. Statically `settleTransactionCommit`;
 * passed by reference into the commit engine so the engine never imports the
 * propagation layer. Unlike the single-settlement shapes it records per-pass
 * errors into `errors` itself — one pass failing must not starve the others.
 */
export type TransactionSettleFn = (
    updatedAtoms: Atom<any>[],
    deletedAtoms: AtomFamilyAtom<any, any>[] | undefined,
    unsetAtoms: Atom<any>[] | undefined,
    data: StoreData,
    report: ChangeReport | undefined,
    errors: CommitErrors,
) => void
