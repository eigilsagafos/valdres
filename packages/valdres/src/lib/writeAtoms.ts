import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import { resolvePendingDefault } from "./resolvePendingDefault"
import { setValueInData } from "./setValueInData"

/** A deferred onSet invocation: the hook, the written value, and the store it
 *  was written to. Collected during the write phase of a cross-scope commit so
 *  hooks fire only once the whole tree has been written. */
export type DeferredOnSet = [Atom<any>, any, StoreData]

/**
 * Write phase for a single store. Applies every value in `pairs` to
 * `data.values`, returning the atoms whose value actually changed (the
 * propagation set), merged with any atoms lazily initialized during the
 * equality checks. This does NOT propagate — see `setAtoms` (single-store
 * fast path) or `Transaction.commit` (cross-scope path) for the notify pass.
 *
 * onSet handling:
 *  - `skipOnSet` true     → never fire onSet.
 *  - `onSetQueue` given    → defer onSet by pushing `[atom, value, data]`. The
 *    cross-scope commit uses this so a hook never observes a half-applied
 *    transaction — it fires only after every store's writes have landed.
 *  - otherwise             → fire onSet inline (single-store path, unchanged).
 */
export const writeAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    skipOnSet = false,
    onSetQueue?: DeferredOnSet[],
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
            if (atom.onSet && !skipOnSet) {
                if (onSetQueue) onSetQueue.push([atom, value, data])
                else atom.onSet(value, data)
            }
            // Landing a real value over a suspense placeholder must resolve
            // the held promise, exactly as setAtom does. setAtom only ever
            // resolves with a settled (non-promise) value, so mirror that:
            // resolve only when replacing a promise (a placeholder is always
            // stored as one) with a non-promise. The `currentIsPromise` gate
            // also keeps the common non-promise txn write off the chain walk.
            if (currentIsPromise && !isPromiseLike(value)) {
                resolvePendingDefault(atom, data, value)
            }
        } else {
            // We do this to ensure that if an atom was set in a scoped transaction but was the same we still override it in that scope
            setValueInData(atom, value, data)
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
