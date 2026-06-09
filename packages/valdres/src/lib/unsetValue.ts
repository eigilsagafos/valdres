import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isAtom } from "../utils/isAtom"
import { getState } from "./getState"
import { getAtomInitValue } from "./initAtom"
import {
    createChangeSink,
    flushChangeSink,
    hasChangeListener,
    reportUnsetAtom,
} from "./notifyChangeListeners"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"

const InvalidStateError = "unset() expects an atom."

/** Remove a store's own value for `atom` and the bookkeeping that tracked it:
 *  the entry in `data.values`, any `maxAge` write timestamp, and — for a scoped
 *  store — the parent's `scopeValueIndex` entry and this scope's `scopeIndexKeys`
 *  membership.
 *
 *  Returns `true` if a value was actually removed, `false` if the store had no
 *  own value (so callers can treat unset as a no-op without notifying). Does NOT
 *  propagate or notify — callers own that. Works on both scoped and root stores
 *  (a root simply has no parent index / scope keys to detach). */
export const detachOwnValue = (atom: Atom<any>, data: StoreData): boolean => {
    if (!data.values.has(atom)) return false

    data.values.delete(atom)
    // Only present for maxAge atoms; guard to avoid materializing the lazy
    // WeakMap getter for the common (non-maxAge) atom.
    if (atom.maxAge !== undefined) data.lastValueWriteAt.delete(atom)

    const parent = data.parent
    if (parent) {
        const scopes = parent.scopeValueIndex.get(atom)
        if (scopes) {
            scopes.delete(data)
            if (scopes.size === 0) parent.scopeValueIndex.delete(atom)
        }
        data.scopeIndexKeys!.delete(atom)
    }
    return true
}

/** Re-establish the parent delegate for every scope-local subscription on
 *  `atom`, so subscribers track ancestor changes again once the scope no longer
 *  shadows it. Inverse of the `reRoot` drop that `setValueInData` triggers when
 *  the scope first shadows an atom. A no-op on a root store (its subscriptions
 *  never delegate, so they carry no `reDelegate`). */
export const reDelegateScopeSubscriptions = (
    atom: Atom<any>,
    data: StoreData,
) => {
    const subs = data.subscriptions.get(atom)
    if (subs) {
        for (const sub of subs) sub.reDelegate?.()
    }
}

/** The value the store reads for `atom` after its own value was removed, used to
 *  populate the `onChange` report:
 *
 *  - **scoped store** → the inherited parent value (already materialized, since
 *    shadowing an atom always initializes the parent first), so this is a cheap
 *    read-through.
 *  - **root store** → the atom's default. We deliberately do NOT re-materialize
 *    (write) it: unset's purpose on a root is to drop the stored value and let
 *    the next read re-initialize lazily. If a live consumer re-read the atom
 *    during propagation it is already back in `data.values`, so we report that;
 *    otherwise we compute the default with `getAtomInitValue` (which does not
 *    write). For an atom whose default is a function/async, computing it here
 *    runs the same initializer the next read would run. */
export const effectiveValueAfterUnset = (
    atom: Atom<any>,
    data: StoreData,
): unknown => {
    const parent = data.parent
    if (parent) {
        const initSet = new Set<Atom>()
        const value = getState(atom, parent, initSet)
        if (initSet.size > 0) propagateAtomUpdate([...initSet], parent, true)
        return value
    }
    if (data.values.has(atom)) return data.values.get(atom)
    return getAtomInitValue(atom, data, new Set())
}

/** Public `store.unset(atom)`: drop the store's own value for `atom` so it
 *  reverts to what it would otherwise read — the natural inverse of `set`
 *  (cf. `git config --unset`).
 *
 *  - On a **scoped store**, the atom re-inherits its parent's current value.
 *  - On a **root store**, the atom reverts to its default; the stored value is
 *    removed (de-materialized) and re-initialized lazily on the next read —
 *    unlike `reset`, which eagerly writes the default back in. (If a live
 *    consumer reads the atom during the resulting propagation, it is of course
 *    re-initialized immediately.)
 *
 *  Throws if `atom` is not an atom. No-op (no propagation, no `onChange`) if the
 *  store has no own value for `atom`. Otherwise removes the value + bookkeeping,
 *  notifies subscribers, dependent selectors, and nested scopes of the reverted
 *  value, re-delegates scope subscriptions so future parent changes are observed
 *  again, and reports the change on `store.onChange` as a `kind: "unset"` (carrying
 *  the reverted value) with `meta.source === "unset"`. */
export const unsetValue = <V>(atom: Atom<V>, data: StoreData): void => {
    if (!isAtom(atom)) throw new Error(InvalidStateError)

    if (!detachOwnValue(atom, data)) return

    // Notify unconditionally once a value was actually removed — even if the
    // reverted value happens to equal the dropped one. This matches `reset`
    // (which also fires without an equality check) and, more importantly, the
    // dropped value IS the event a dev-tools `onChange` observer needs to see:
    // suppressing it on value-equality would lose the very signal `source:
    // "unset"` exists to carry.
    if (hasChangeListener(data)) {
        // Coalesce the atom unset and any dependent-selector recomputes into one
        // onChange callback. Buffer the atom first (atoms precede selectors), then
        // propagate with reportAtoms=false: the propagation reports only the
        // selectors it recomputes, never the atom (already emitted as "unset").
        const sink = createChangeSink(undefined, "unset")
        reportUnsetAtom(atom, data, effectiveValueAfterUnset(atom, data), sink)
        // skipFamilyIndexUpdate=false (default), reportAtoms=false (atom already
        // emitted as "unset"; only report the selectors it recomputes).
        propagateAtomUpdate([atom], data, false, undefined, sink, false, false)
        // Resume parent delegation AFTER subscribers fire (during propagation),
        // so a scope subscriber's idempotent delegate drop doesn't undo it.
        reDelegateScopeSubscriptions(atom, data)
        flushChangeSink(sink)
    } else {
        propagateAtomUpdate([atom], data, false)
        reDelegateScopeSubscriptions(atom, data)
    }
}
