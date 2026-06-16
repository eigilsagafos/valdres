import type { Atom } from "../types/Atom"
import type { SyncSetAtom } from "../types/SyncSetAtom"

/** [Docs Reference](https://valdres.dev/valdres/api/setAtomPairs)
 *
 * Apply `[atom, value]` pairs through a set function — the low-level primitive
 * behind an `InitializeCallback`. Most adapters don't call it directly: prefer
 * `applyInitialize(txn, initialize)`, which runs the callback and applies its
 * pairs with the correct `Array.isArray` guard (a single-expression
 * `initialize` that wrote through `txn.set` returns a non-array, which a naive
 * truthiness check would feed back into `setAtomPairs` and throw).
 *
 * @example
 * store.txn(txn => {
 *     const pairs = initialize(txn)
 *     if (Array.isArray(pairs)) setAtomPairs(txn.set, pairs)
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
