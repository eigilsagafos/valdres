import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import type { ChangeReport } from "./notifyChangeListeners"
import {
    createCommitErrors,
    recordCommitError,
    throwCommitError,
} from "./commitErrors"
import {
    applyGlobalSets,
    beginGlobalCommit,
    endGlobalCommit,
    type DeferredGlobalSet,
} from "./globalAtomFanOut"
import { createChangeSink, flushChangeSink } from "./notifyChangeListeners"
import {
    notifyDeferred,
    propagateAtomUpdate,
    type NotifyTarget,
} from "./propagateUpdatedAtoms"
import { runOnSets, writeAtoms, type DeferredOnSet } from "./writeAtoms"

export const setAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    skipOnSet = false,
    report?: ChangeReport,
) => {
    const onSets: DeferredOnSet[] = []
    const globalSets: DeferredGlobalSet[] = []
    const updatedAtoms = writeAtoms(
        pairs,
        data,
        initializedAtomsSet,
        skipOnSet,
        onSets,
        globalSets,
    )
    const errors = createCommitErrors()

    // Complete global fan-out while still in the write phase. Only after every
    // peer has been attempted do user hooks run.
    const globalUpdates = applyGlobalSets(globalSets, errors)
    runOnSets(onSets, errors)

    if (globalUpdates.size === 0) {
        if (updatedAtoms.length > 0) {
            try {
                propagateAtomUpdate(
                    updatedAtoms,
                    data,
                    false,
                    undefined,
                    report,
                )
            } catch (error) {
                recordCommitError(errors, error)
            }
        }
    } else {
        // Fan-out is one logical commit: settle every store's selectors before
        // firing any subscriber, and let no store's error starve a later store.
        const notify: NotifyTarget = new Map()
        const globalSink = createChangeSink(undefined, "set")
        const commitRoots = beginGlobalCommit(data, globalUpdates)
        // Global peer changes retain their historical direct-set metadata and
        // are reported before the transaction origin.
        for (const [peer, atoms] of globalUpdates) {
            try {
                propagateAtomUpdate(atoms, peer, false, notify, globalSink)
            } catch (error) {
                recordCommitError(errors, error)
            }
        }
        if (updatedAtoms.length > 0) {
            try {
                propagateAtomUpdate(updatedAtoms, data, false, notify, report)
            } catch (error) {
                recordCommitError(errors, error)
            }
        }
        try {
            notifyDeferred(notify)
        } catch (error) {
            recordCommitError(errors, error)
        }
        try {
            flushChangeSink(globalSink)
        } catch (error) {
            recordCommitError(errors, error)
        }
        endGlobalCommit(commitRoots, errors)
    }

    throwCommitError(errors)
}
