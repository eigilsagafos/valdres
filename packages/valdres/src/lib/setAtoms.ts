import type { Atom } from "../types/Atom"
import type { StoreData } from "../types/StoreData"
import type { ChangeReport } from "./notifyChangeListeners"
import {
    createCommitErrors,
    recordCommitError,
    throwCommitError,
} from "./commitErrors"
import {
    applyGlobalOnSets,
    beginGlobalCommit,
    endGlobalCommit,
} from "./globalAtomFanOut"
import { createChangeSink, flushChangeSink } from "./notifyChangeListeners"
import {
    notifyDeferred,
    propagateAtomUpdate,
    type NotifyTarget,
} from "./propagateUpdatedAtoms"
import { runOnSets, writeAtoms, type DeferredOnSet } from "./writeAtoms"

// Safe only with writeAtoms(skipOnSet=true), which cannot mutate this queue.
// Reusing it keeps transactions without hooks/globals on the pre-fix
// allocation profile.
const noOnSets: DeferredOnSet[] = []

export const setAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    skipOnSet = false,
    report?: ChangeReport,
    hasCommitEffects = true,
) => {
    if (skipOnSet || !hasCommitEffects) {
        const updatedAtoms = writeAtoms(
            pairs,
            data,
            initializedAtomsSet,
            true,
            noOnSets,
        )
        if (updatedAtoms.length > 0) {
            propagateAtomUpdate(updatedAtoms, data, false, undefined, report)
        }
        return
    }

    const onSets: DeferredOnSet[] = []
    const updatedAtoms = writeAtoms(
        pairs,
        data,
        initializedAtomsSet,
        false,
        onSets,
    )
    const errors = createCommitErrors()

    // Complete global fan-out while still in the write phase. Only after every
    // peer has been attempted do user hooks run.
    const globalUpdates = applyGlobalOnSets(onSets, errors)
    runOnSets(onSets, errors)

    if (!globalUpdates || globalUpdates.size === 0) {
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
