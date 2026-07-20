import type { Atom } from "../types/Atom"
import type { BulkWriteIntent } from "../types/CommitIntent"
import type { StoreData } from "../types/StoreData"
import { runCommitPlan } from "./commitEngine"
import { SETTLE_DEFAULT } from "./commitIntents"
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
    settleCommit,
    type NotifyTarget,
} from "./propagateUpdatedAtoms"
import { runOnSets, type DeferredOnSet } from "./runOnSets"
import { writeAtoms } from "./writeAtoms"

// Safe only with writeAtoms(onSet: "skip"), which cannot mutate this queue.
// Reusing it keeps transactions without hooks/globals on the pre-fix
// allocation profile.
const noOnSets: DeferredOnSet[] = []

/**
 * Bulk-write coordinator of the commit engine: the single-store transaction
 * commit delegate. Phases 1–2 run through writeAtoms; a hook-free commit
 * settles immediately (allocation-free — shared empty queue, shared frozen
 * flags); a hooked non-global commit runs phases 3–9 through runCommitPlan.
 * Global fan-out is unmigrated: peer values are still applied here (they
 * belong to the write phase), and when any peer changed, the multi-store
 * sequencing below runs as a legacy adapter.
 */
export const setAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    intent: BulkWriteIntent,
) => {
    if (intent.onSet === "skip") {
        const updatedAtoms = writeAtoms(
            pairs,
            data,
            initializedAtomsSet,
            "skip",
            noOnSets,
        )
        if (updatedAtoms.length > 0) {
            settleCommit(
                updatedAtoms,
                data,
                undefined,
                intent.report,
                SETTLE_DEFAULT,
            )
        }
        return
    }

    const onSets: DeferredOnSet[] = []
    const updatedAtoms = writeAtoms(
        pairs,
        data,
        initializedAtomsSet,
        "collect",
        onSets,
    )
    const errors = createCommitErrors()

    // Complete global fan-out while still in the write phase. Only after every
    // peer has been attempted do user hooks run — on the non-global arm inside
    // runCommitPlan, on the global arm explicitly below. Both arms branch on
    // the map applyGlobalOnSets already returned (runOnSets cannot mutate it),
    // so hook order relative to peer writes is unchanged.
    const globalUpdates = applyGlobalOnSets(onSets, errors)

    if (!globalUpdates || globalUpdates.size === 0) {
        runCommitPlan({
            data,
            updatedAtoms,
            onSets,
            errors,
            settle: settleCommit,
            report: intent.report,
        })
        return
    }

    // —— LEGACY GLOBAL FAN-OUT ADAPTER (unmigrated) ——
    // Fan-out is one logical commit: settle every store's selectors before
    // firing any subscriber, and let no store's error starve a later store.
    runOnSets(onSets, errors)
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
            propagateAtomUpdate(updatedAtoms, data, false, notify, intent.report)
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

    throwCommitError(errors)
}
