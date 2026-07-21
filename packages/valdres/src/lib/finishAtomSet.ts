import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { runHookedDirectWrite } from "./commitEngine"
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
import { getStoreRuntime } from "./getStoreRuntime"
import { globalOnSetMarker } from "./globalOnSetMarker"
import { createChangeSink, flushChangeSink } from "./notifyChangeListeners"
import {
    notifyDeferred,
    propagateAtomUpdate,
    settleCommit,
    type NotifyTarget,
} from "./propagateUpdatedAtoms"

/**
 * LEGACY ADAPTER — slow path for a settled hooked write that is GLOBAL (peer
 * fan-out, unmigrated) or arrives from ASYNC settlement (coordinateAsyncWrite,
 * unmigrated). The non-global branch is a pure delegation into the commit
 * engine — observer sequencing lives once, in runHookedDirectWrite — and is
 * kept only because coordinateAsyncWrite still enters here; the direct path
 * (setAtom) calls the engine without this hop. For a global atom, peer writes
 * are applied first, then the hook runs, then every store propagates and
 * notifies. Errors never interrupt a later phase; the first is rethrown last.
 */
export const finishAtomSet = <Value>(
    atom: Atom<Value>,
    value: Value,
    data: StoreData,
    updatedAtoms: Atom<any>[],
    source: "set" | "async-set",
) => {
    if (!isGlobalAtom(atom)) {
        return runHookedDirectWrite(
            atom,
            value,
            data,
            updatedAtoms,
            source,
            settleCommit,
        )
    }

    const errors = createCommitErrors()
    const globalUpdates = applyGlobalSets([[atom, value, data]], errors)

    try {
        if (atom.onSet !== globalOnSetMarker) {
            atom.onSet!(value, getStoreRuntime(data))
        }
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
