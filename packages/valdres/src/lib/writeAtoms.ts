import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import type { CommitErrors } from "./commitErrors"
import { recordCommitError } from "./commitErrors"
import { getState } from "./getState"
import { resolvePendingDefault } from "./resolvePendingDefault"
import { setValueInData } from "./setValueInData"

/** A deferred onSet invocation: the atom, written value, and originating store. */
export type DeferredOnSet = [Atom<any>, any, StoreData]

/** Run every hook in insertion order, retaining the first failure. */
export const runOnSets = (onSets: DeferredOnSet[], errors: CommitErrors) => {
    for (const [atom, value, data] of onSets) {
        try {
            atom.onSet!(value, data)
        } catch (error) {
            recordCommitError(errors, error)
        }
    }
}

/**
 * Write phase for a single store. Applies every value in `pairs` to
 * `data.values`, returning the atoms whose value actually changed (the
 * propagation set), merged with any atoms lazily initialized during the
 * equality checks. This does NOT propagate — see `setAtoms` (single-store
 * fast path) or `Transaction.commit` (cross-scope path) for the notify pass.
 *
 * Hook and global handling are deliberately collection-only. The caller first
 * completes every local/global write, then runs `onSetQueue`, then propagates.
 * This keeps a throwing hook from interrupting either the write or propagation
 * phase.
 */
export const writeAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    skipOnSet: boolean,
    onSetQueue: DeferredOnSet[],
): Atom[] => {
    const updatedAtoms: Atom[] = []
    for (let [atom, value] of pairs) {
        const currentValue = getState(atom, data, initializedAtomsSet)
        const currentIsPromise = isPromiseLike(currentValue)
        const areEqual = currentIsPromise || isPromiseLike(value)
            ? currentValue === value
            : atom.equal(currentValue, value)
        if (!areEqual) {
            updatedAtoms.push(atom)
            value = setValueInData(atom, value, data)
            // Landing a settled value over a suspense placeholder must resolve
            // the held promise, exactly as setAtom does. Two gates, both load-
            // bearing (see resolvePendingDefault's contract):
            //   currentIsPromise   — a placeholder is always a promise, so a
            //     non-promise prior value can't have one; skips the chain walk
            //     on the common (non-promise) write, i.e. the benchmark hot path.
            //   !isPromiseLike(value) — only resolve with a settled value;
            //     storing an in-flight promise must not consume the placeholder,
            //     so a later settled write can still resolve it.
            if (currentIsPromise && !isPromiseLike(value)) {
                resolvePendingDefault(atom, data, value)
            }
            // Global atoms always carry a no-op marker hook, so one existing
            // property read identifies every write that needs the phased slow
            // path. Ordinary atoms avoid an Object.hasOwn/global check here.
            if (!skipOnSet && atom.onSet) {
                onSetQueue.push([atom, value, data])
            }
        } else {
            // We do this to ensure that if an atom was set in a scoped transaction but was the same we still override it in that scope
            setValueInData(atom, value, data)
            // No placeholder to resolve here: areEqual with a settled value
            // means there was none (a placeholder is a promise, never equal to
            // a settled value), and equal promises are the same reference — a
            // no-op set, not a value landing.
        }
    }
    // Merge updatedAtoms and initializedAtomsSet without extra Set+spread
    if (initializedAtomsSet.size > 0) {
        for (const atom of initializedAtomsSet) {
            updatedAtoms.push(atom)
        }
    }
    return updatedAtoms
}
