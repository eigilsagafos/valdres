import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { runHookedDirectWrite } from "./commitEngine"
import {
    createCommitErrors,
    recordCommitError,
    throwCommitError,
} from "./commitErrors"
import { applyGlobalSets, settleGlobalAtomSet } from "./globalAtomFanOut"
import { getStoreRuntime } from "./getStoreRuntime"
import { globalOnSetMarker } from "./globalOnSetMarker"
import { settleCommit } from "./propagateUpdatedAtoms"

/**
 * LEGACY ADAPTER — slow path for an ordinary synchronous GLOBAL write (peer
 * fan-out is intentionally outside this migration). The non-global branch is
 * retained as a pure delegation into the commit engine. Async global writes
 * split these same apply/hook/settle primitives across their CommitPlan. Peer
 * writes are applied first, then the hook runs, then every store propagates and
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

    settleGlobalAtomSet(data, updatedAtoms, globalUpdates, source, errors)

    throwCommitError(errors)
}
