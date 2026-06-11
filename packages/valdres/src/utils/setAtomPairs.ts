import type { Atom } from "../types/Atom"
import type { SyncSetAtom } from "../types/SyncSetAtom"

/** [Docs Reference](https://valdres.dev/valdres/api/setAtomPairs)
 *
 * Apply `[atom, value]` pairs through a set function — typically the pairs an
 * `InitializeCallback` returned, applied via the same transaction's `txn.set`:
 *
 * @example
 * store.txn(txn => {
 *     const pairs = initialize(txn)
 *     if (pairs) setAtomPairs(txn.set, pairs)
 * })
 *
 * It only calls `set`, so scope, family, and async semantics are exactly those
 * of the transaction (or store) the set function belongs to.
 */
export const setAtomPairs = (
    set: SyncSetAtom,
    pairs: [Atom<any>, any][],
): void => {
    for (const [atom, value] of pairs) {
        set(atom, value)
    }
}
