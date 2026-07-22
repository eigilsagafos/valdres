import type { Atom } from "../types/Atom"
import type { OnSetPolicy } from "../types/CommitIntent"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { coordinateAsyncWrite } from "./coordinateAsyncWrite"
import { DIRECT_WRITE, SEED_WRITE } from "./commitIntents"
import { getState } from "./getState"
import { resolvePendingDefault } from "./resolvePendingDefault"
import type { DeferredOnSet } from "./runOnSets"
import { setValueInData } from "./setValueInData"

/**
 * Write phase (commit phases 1–2) for a single store. Applies every value in
 * `pairs` to `data.values`, returning the atoms whose value actually changed
 * (the propagation set), merged with any atoms lazily initialized during the
 * equality checks. This does NOT propagate — the bulk coordinators in
 * `setAtoms.ts`, the transaction CommitPlan, and the cross-scope transaction
 * pipeline own notify.
 *
 * Hook and global handling are deliberately collection-only. The caller first
 * completes every local/global write, then runs `onSetQueue`, then propagates.
 * This keeps a throwing hook from interrupting either the write or propagation
 * phase. The typed policy is translated to shared direct-write intent
 * singletons once per batch, so async coordination adds no per-write object.
 */
export const writeAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    onSetPolicy: OnSetPolicy,
    onSetQueue: DeferredOnSet[],
): Atom[] => {
    const updatedAtoms: Atom[] = []
    const directIntent = onSetPolicy === "skip" ? SEED_WRITE : DIRECT_WRITE
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
                    directIntent,
                )
                // A bare thenable normalizes to a different Promise. Keep the
                // transaction's staged entry in sync so an explicit commit
                // followed by execute()'s auto-commit cannot adopt it twice.
                if (promise !== value) pairs.set(atom, promise)
                value = promise
            } else {
                value = setValueInData(atom, value, data)
                // Landing a settled value over a suspense placeholder must
                // resolve the held promise, exactly as setAtom does. The
                // currentIsPromise gate keeps the common write path from walking
                // the scope chain; an in-flight value took the async branch.
                if (currentIsPromise) {
                    resolvePendingDefault(atom, data, value)
                }
                // Global atoms always carry a no-op marker hook, so one existing
                // property read identifies every settled write that needs the
                // phased slow path. Async hooks run after settlement through the
                // shared coordinator instead of receiving the pending Promise.
                if (onSetPolicy === "collect" && atom.onSet) {
                    onSetQueue.push([atom, value, data])
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
                    directIntent,
                )
                if (promise !== value) pairs.set(atom, promise)
            } else {
                if (
                    onSetPolicy === "collect" &&
                    data.parent &&
                    !data.values.has(atom) &&
                    isGlobalAtom(atom)
                ) {
                    atom.attach(data)
                }
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
