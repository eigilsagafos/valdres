import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import {
    createCommitErrors,
    recordCommitError,
    throwCommitError,
} from "./commitErrors"
import {
    applyGlobalSets,
    beginGlobalCommit,
    endGlobalCommit,
} from "./globalAtomFanOut"
import { createChangeSink, flushChangeSink } from "./notifyChangeListeners"
import {
    notifyDeferred,
    propagateAtomUpdate,
    type NotifyTarget,
} from "./propagateUpdatedAtoms"

/**
 * Slow path for a settled write carrying an onSet hook (global atoms always
 * carry a no-op marker hook). Global peer writes are applied first, then the
 * hook runs, then every store propagates and notifies. Errors never interrupt a
 * later phase; the first is rethrown last.
 */
export const finishAtomSet = <Value>(
    atom: Atom<Value>,
    value: Value,
    data: StoreData,
    updatedAtoms: Atom<any>[],
    source: "set" | "async-set",
) => {
    if (!isGlobalAtom(atom)) {
        let hasHookError = false
        let hookError: unknown
        try {
            atom.onSet!(value, data)
        } catch (error) {
            hasHookError = true
            hookError = error
        }
        try {
            propagateAtomUpdate(updatedAtoms, data, false, undefined, source)
        } catch (error) {
            if (hasHookError) throw hookError
            throw error
        }
        if (hasHookError) throw hookError
        return
    }

    const errors = createCommitErrors()
    const globalUpdates = applyGlobalSets([[atom, value]], errors)

    try {
        atom.onSet!(value, data)
    } catch (error) {
        recordCommitError(errors, error)
    }

    if (globalUpdates.size === 0) {
        try {
            propagateAtomUpdate(updatedAtoms, data, false, undefined, source)
        } catch (error) {
            recordCommitError(errors, error)
        }
    } else {
        const notify: NotifyTarget = new Map()
        const changeSink = createChangeSink(undefined, source)
        const commitRoots = beginGlobalCommit(data, globalUpdates)
        // Preserve global onChange ordering: peers report before the origin.
        for (const [peer, peerAtoms] of globalUpdates) {
            try {
                propagateAtomUpdate(peerAtoms, peer, false, notify, changeSink)
            } catch (error) {
                recordCommitError(errors, error)
            }
        }
        try {
            propagateAtomUpdate(updatedAtoms, data, false, notify, changeSink)
        } catch (error) {
            recordCommitError(errors, error)
        }
        try {
            notifyDeferred(notify)
        } catch (error) {
            recordCommitError(errors, error)
        }
        try {
            flushChangeSink(changeSink)
        } catch (error) {
            recordCommitError(errors, error)
        }
        endGlobalCommit(commitRoots, errors)
    }

    throwCommitError(errors)
}
