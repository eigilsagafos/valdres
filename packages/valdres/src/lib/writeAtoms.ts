import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { coordinateAsyncWrite } from "./coordinateAsyncWrite"
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
        const valueIsPromise = isPromiseLike(value)
        const areEqual =
            currentIsPromise || valueIsPromise
                ? currentValue === value
                : atom.equal(currentValue, value)
        if (!areEqual) {
            updatedAtoms.push(atom)
            if (valueIsPromise) {
                const promise = coordinateAsyncWrite(
                    atom,
                    value,
                    currentValue,
                    data,
                    skipOnSet,
                )
                // A bare thenable normalizes to a different Promise. Keep the
                // transaction's staged entry in sync so an explicit commit
                // followed by execute()'s auto-commit cannot adopt it twice.
                if (promise !== value) pairs.set(atom, promise)
                value = promise
            } else {
                value = setValueInData(atom, value, data)
                if (atom.onSet && !skipOnSet) {
                    if (onSetQueue) onSetQueue.push([atom, value, data])
                    else atom.onSet(value, data)
                }
                // Landing a settled value over a suspense placeholder must
                // resolve the held promise, exactly as setAtom does. The
                // currentIsPromise gate keeps the common write path from walking
                // the scope chain; an in-flight value took the async branch.
                if (currentIsPromise) {
                    resolvePendingDefault(atom, data, value)
                }
            }
        } else {
            // We do this to ensure that if an atom was set in a scoped transaction but was the same we still override it in that scope
            if (valueIsPromise && data.parent && !data.values.has(atom)) {
                // Pinning an inherited in-flight value creates a scope-local
                // write. Give that shadow its own settlement coordinator; the
                // ancestor's stale guard only updates the ancestor store.
                const promise = coordinateAsyncWrite(
                    atom,
                    value,
                    currentValue,
                    data,
                    skipOnSet,
                )
                if (promise !== value) pairs.set(atom, promise)
            } else {
                setValueInData(atom, value, data)
            }
            // No placeholder to resolve here: equal settled values have none,
            // and an equal own promise is already coordinated by its first write.
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
