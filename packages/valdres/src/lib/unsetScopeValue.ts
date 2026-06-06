import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isAtom } from "../utils/isAtom"
import { getState } from "./getState"
import { hasChangeListener, reportUnsetAtom } from "./notifyChangeListeners"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"

const RootStoreError =
    "unset() can only be called on a scoped store — a root store has no parent to re-inherit from."
const InvalidStateError = "unset() expects an atom."

/** Remove a scope's own value for `atom` and the bookkeeping that tracked it:
 *  the shadow in `data.values`, the parent's `scopeValueIndex` entry, this
 *  scope's `scopeIndexKeys` membership, and any `maxAge` write timestamp.
 *
 *  Returns `true` if a shadow was actually removed, `false` if the scope had no
 *  own value (so callers can treat unset as a no-op without notifying). Does NOT
 *  propagate or notify — callers own that. Assumes `data` is a scoped store
 *  (`data.parent` is defined). */
export const detachScopeValue = (atom: Atom<any>, data: StoreData): boolean => {
    if (!data.values.has(atom)) return false

    data.values.delete(atom)
    // Only present for maxAge atoms; guard to avoid materializing the lazy
    // WeakMap getter for the common (non-maxAge) atom.
    if (atom.maxAge !== undefined) data.lastValueWriteAt.delete(atom)

    const parent = data.parent!
    const scopes = parent.scopeValueIndex.get(atom)
    if (scopes) {
        scopes.delete(data)
        if (scopes.size === 0) parent.scopeValueIndex.delete(atom)
    }
    data.scopeIndexKeys!.delete(atom)
    return true
}

/** Re-establish the parent delegate for every scope-local subscription on
 *  `atom`, so subscribers track ancestor changes again once the scope no longer
 *  shadows it. Inverse of the `reRoot` drop that `setValueInData` triggers when
 *  the scope first shadows an atom. */
export const reDelegateScopeSubscriptions = (
    atom: Atom<any>,
    data: StoreData,
) => {
    const subs = data.subscriptions.get(atom)
    if (subs) {
        for (const sub of subs) sub.reDelegate?.()
    }
}

/** Public `scopedStore.unset(atom)`: drop the scope's own value for `atom` so it
 *  re-inherits its parent's current value. The natural inverse of `set` (which
 *  creates the scope-local shadow); cf. `git config --unset`.
 *
 *  - Throws if `atom` is not an atom, or if called on a root store (no parent to
 *    inherit from).
 *  - No-op (no propagation, no `onChange`) if the scope has no own value for
 *    `atom`.
 *  - Otherwise removes the shadow + bookkeeping, notifies the scope's
 *    subscribers and dependent selectors (and nested scopes) of the now-inherited
 *    value, re-delegates subscriptions so future parent changes are observed
 *    again, and reports the change on `store.onChange` as a `kind: "set"` (the
 *    inherited value) with `meta.source === "unset"`. */
export const unsetScopeValue = <V>(atom: Atom<V>, data: StoreData): void => {
    if (!isAtom(atom)) throw new Error(InvalidStateError)
    if (!data.parent) throw new Error(RootStoreError)

    if (!detachScopeValue(atom, data)) return

    // Notify unconditionally once a shadow was actually removed — even if the
    // inherited value happens to equal the dropped shadow. This matches `reset`
    // (which also fires without an equality check) and, more importantly, the
    // dropped-override IS the event a dev-tools `onChange` observer needs to see:
    // suppressing it on value-equality would lose the very signal `source:
    // "unset"` exists to carry. The only cost is a rare redundant value-subscriber
    // notification when a scope shadowed an atom with its parent's current value.
    //
    // `report` is left undefined here: the standard reporter reads `data.values`,
    // which we just emptied — the unset change (with the inherited value) is
    // emitted separately below.
    propagateAtomUpdate([atom], data, false)

    // Resume parent delegation AFTER the on-unset notification, so the callback's
    // own (idempotent, now no-op) delegate drop doesn't undo the fresh delegate.
    reDelegateScopeSubscriptions(atom, data)

    if (hasChangeListener(data)) {
        // Reading the inherited value is normally a plain lookup: shadowing an
        // atom in a scope (via set, directly or in a txn) always initializes the
        // parent first (getState walks the chain), so the parent already holds a
        // value here. The init set is therefore empty in every reachable case;
        // we still propagate it (rather than swallow it) so the report can never
        // diverge from what a real read would have committed.
        const initSet = new Set<Atom>()
        const inherited = getState(atom, data.parent, initSet)
        if (initSet.size > 0) {
            propagateAtomUpdate([...initSet], data.parent, true)
        }
        reportUnsetAtom(atom, data, inherited, "unset")
    }
}
