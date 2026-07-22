import type { CommitErrors } from "../lib/commitErrors"
import type { StoreAtomUpdates } from "../lib/globalAtomFanOut"
import type { ChangeReport } from "../lib/notifyChangeListeners"
import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { StoreData } from "./StoreData"

/**
 * One store's finalized slot in a cross-scope transaction commit. The write
 * phase has already applied every value; the settlement walk reads these slots
 * to settle each affected store exactly once. `deleted` is undefined (never
 * empty) when absent; `unsetAtoms` may be an empty array (an unset of an atom
 * with no own value detaches nothing). `children` links the direct scoped
 * entries of this store's transaction, so the walk can visit plan stores
 * without reconstructing the tree — scopes reached only through the inherited
 * dependency branch index have no entry at all.
 */
export type TransactionTreeEntry = {
    data: StoreData
    updatedAtoms: Atom<any>[]
    deleted: AtomFamilyAtom<any, any>[] | undefined
    unsetAtoms: Atom<any>[] | undefined
    children: TransactionTreeEntry[] | undefined
}

/**
 * Settlement (phases 4–7) of a cross-scope transaction commit: one root-first
 * walk over the affected store tree, settling each store once against the
 * union of its own writes and the inherited changes that reach it, then firing
 * every collected subscriber once. `entries` is the flat root-first plan
 * (`entries[0]` is the transaction's topmost written store); `globalUpdates`
 * carries changed global peers (already written) whose per-tree propagation
 * brackets the walk. Statically `settleTransactionTreeCommit`; passed by
 * reference into the commit engine so the engine never imports the propagation
 * layer. Like the single-store transaction settlement it records per-store
 * errors into `errors` itself — one store failing must not starve the others.
 */
export type TransactionTreeSettleFn = (
    entries: TransactionTreeEntry[],
    globalUpdates: StoreAtomUpdates | undefined,
    report: ChangeReport | undefined,
    errors: CommitErrors,
) => void
