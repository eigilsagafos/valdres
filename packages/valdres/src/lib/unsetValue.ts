import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isAtom } from "../utils/isAtom"
import { clearSupersededAsyncAtomCoordinator } from "./asyncAtomCoordinatorRegistry"
import { runCommitPlan } from "./commitEngine"
import { cacheState } from "./cacheState"
import { createCommitErrors } from "./commitErrors"
import { SETTLE_INIT_ONLY, SETTLE_UNSET } from "./commitIntents"
import { NO_ON_SETS, updateSettlement } from "./commitPlans"
import { getState } from "./getState"
import {
    refreshInheritedDependencyBranch,
} from "./graph"
import {
    createChangeSink,
    flushChangeSink,
    hasChangeListener,
    reportUnsetAtom,
} from "./notifyChangeListeners"
import { activeCommitBoundary } from "./onCommitEnd"
import { untrackNamedAtom } from "./namedStateIndex"
import { settleCommit } from "./propagateUpdatedAtoms"
import { noteStateValueChanged } from "./stateRevisions"

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

    clearSupersededAsyncAtomCoordinator(atom, data)
    data.values.delete(atom)
    untrackNamedAtom(atom, data)
    noteStateValueChanged(atom, data)
    // Only present for maxAge atoms; guard to avoid materializing the lazy
    // WeakMap getter for the common (non-maxAge) atom.
    if (atom.maxAge !== undefined) cacheState.clearWrite(atom, data)

    const parent = data.parent
    if (parent) {
        const scopes = parent.scopeValueIndex.get(atom)
        if (scopes) {
            scopes.delete(data)
            if (scopes.size === 0) parent.scopeValueIndex.delete(atom)
        }
        data.scopeIndexKeys!.delete(atom)
        // Dropping the shadow may expose this store's local/descendant
        // dependents to ancestor writes again.
        refreshInheritedDependencyBranch(atom, data)
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

/** The already-available value the store reads for `atom` after its own value
 *  was removed, used to populate the `onChange` report:
 *
 *  - **scoped store** → the inherited parent value (already materialized, since
 *    shadowing an atom always initializes the parent first), so this is a cheap
 *    read-through.
 *  - **root store** → `undefined`; `reportUnsetAtom` carries an already-
 *    materialized value when buffering, otherwise omits it and lets the change
 *    sink recheck `data.values` after propagation. Reporting must never evaluate
 *    a lazy function/async default: root unset stays observationally neutral and
 *    the next read initializes it exactly as it would without an `onChange`
 *    listener. */
export const effectiveValueAfterUnset = (
    atom: Atom<any>,
    data: StoreData,
): unknown => {
    const parent = data.parent
    if (!parent) return undefined
    const initSet = new Set<Atom>()
    const value = getState(atom, parent, initSet)
    if (initSet.size > 0)
        settleCommit(
            [...initSet],
            parent,
            undefined,
            undefined,
            SETTLE_INIT_ONLY,
        )
    return value
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
 *  again, and reports the change on `store.onChange` as a `kind: "unset"` with
 *  `meta.source === "unset"`. A scope change carries its inherited value. A root
 *  change carries a value only if propagation rematerialized the atom; otherwise
 *  the value is omitted to preserve lazy-default semantics. */
export const unsetValue = <V>(atom: Atom<V>, data: StoreData): void => {
    if (!isAtom(atom)) throw new Error(InvalidStateError)

    if (!detachOwnValue(atom, data)) return

    // Notify unconditionally once a value was actually removed — even when the
    // effective value is equal. The plan buffers the distinct `unset` atom
    // record before settlement, reports only recomputed selectors from the
    // update pass, re-delegates after subscribers, then flushes onChange.
    const changeSink = hasChangeListener(data)
        ? createChangeSink(undefined, "unset")
        : undefined
    const settlement = updateSettlement(
        data,
        [atom],
        settleCommit,
        SETTLE_UNSET,
    )
    const afterSettle = () => reDelegateScopeSubscriptions(atom, data)
    const boundary = activeCommitBoundary()
    // Historical direct-unset behavior short-circuits cleanup/onChange if
    // reporting or propagation itself throws.
    if (changeSink === undefined) {
        // Nothing listening: the removal record has no delivery target, so the
        // plan carries no report preparation either.
        runCommitPlan({
            data,
            settlement,
            onSets: NO_ON_SETS,
            errors: createCommitErrors(),
            report: undefined,
            afterSettle,
            boundary,
            continueAfterError: false,
        })
        return
    }
    runCommitPlan({
        data,
        settlement,
        onSets: NO_ON_SETS,
        errors: createCommitErrors(),
        report: changeSink,
        beforeSettle: report =>
            reportUnsetAtom(
                atom,
                data,
                effectiveValueAfterUnset(atom, data),
                report,
            ),
        afterSettle,
        flushReport: () => flushChangeSink(changeSink),
        boundary,
        continueAfterError: false,
    })
}
