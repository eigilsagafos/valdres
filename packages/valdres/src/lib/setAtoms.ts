import type { Atom } from "../types/Atom"
import type { BulkWriteIntent } from "../types/CommitIntent"
import type { InternalAtom } from "../types/InternalAtom"
import type { StoreData } from "../types/StoreData"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import { runCommitPlan } from "./commitEngine"
import { BULK_WITH_EFFECTS_SILENT, SETTLE_DEFAULT } from "./commitIntents"
import {
    createCommitErrors,
    recordCommitError,
    throwCommitError,
} from "./commitErrors"
import { equal } from "./equal"
import {
    applyGlobalOnSets,
    beginGlobalCommit,
    endGlobalCommit,
} from "./globalAtomFanOut"
import {
    createChangeSink,
    flushChangeSink,
    type ChangeReport,
} from "./notifyChangeListeners"
import {
    notifyDeferred,
    propagateAtomUpdate,
    settleCommit,
    type NotifyTarget,
} from "./propagateUpdatedAtoms"
import { runOnSets, type DeferredOnSet } from "./runOnSets"
import { setValueInData } from "./setValueInData"
import { writeAtoms } from "./writeAtoms"

// Safe only with writeAtoms(skipOnSet=true), which cannot mutate this queue.
// Reusing it keeps hook-free bulk writes allocation-light.
const noOnSets: DeferredOnSet[] = []
const FRESH_ATOM_FAST_PATH_MIN = 256

/**
 * Bulk-write coordinator of the commit engine: the single-store transaction
 * commit delegate. Phases 1–2 run through writeAtoms; a hook-free commit
 * settles immediately (allocation-free — shared empty queue, shared frozen
 * flags); a hooked non-global commit runs phases 3–9 through runCommitPlan.
 * Global fan-out is unmigrated: peer values are still applied here (they
 * belong to the write phase), and when any peer changed, the multi-store
 * sequencing below runs as a legacy adapter.
 */
export const commitAtoms = (
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
            true,
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
        false,
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
            propagateAtomUpdate(
                updatedAtoms,
                data,
                false,
                notify,
                intent.report,
            )
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

/**
 * An unobserved root transaction can avoid retaining both a large
 * initialization Set and a duplicate propagation array when every write is to
 * a fresh ordinary atom with a side-effect-free primitive default. Such atoms
 * cannot have subscribers or selector dependents (either would already have
 * initialized them), so the write phase is also the final phase. The strict,
 * all-or-nothing qualification keeps every extensible atom shape on the
 * established path.
 */
const tryWriteFreshSimpleAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
): boolean => {
    // Keep ordinary/small transactions byte-for-byte on the established path;
    // only large initialization batches create the retained-capacity problem
    // this specialization exists to avoid.
    if (data.parent || pairs.size < FRESH_ATOM_FAST_PATH_MIN) return false
    for (const [atom, value] of pairs) {
        if (data.values.has(atom) || isPromiseLike(value)) return false
        const defaultValue = atom.defaultValue
        const defaultType = typeof defaultValue
        if (
            defaultValue === undefined ||
            (defaultValue !== null &&
                (defaultType === "object" || defaultType === "function")) ||
            isFamilyAtom(atom) ||
            atom.equal !== equal ||
            atom.onSet !== undefined ||
            atom.name !== undefined ||
            atom.schema !== undefined ||
            atom.maxAge !== undefined ||
            data.subscriptions.has(atom) ||
            data.stateDependents.has(atom) ||
            data.stateRevisionClock.tracked?.has(atom) ||
            data.inheritedDependencyBranches.has(atom) ||
            (atom as InternalAtom).onInit !== undefined
        ) {
            return false
        }
    }
    for (const [atom, value] of pairs) {
        // Match initAtom's primitive landing before equality. If equality ever
        // throws, the initialized default remains just as it did previously.
        data.values.set(atom, atom.defaultValue)
        atom.equal(atom.defaultValue, value)
        setValueInData(atom, value, data)
    }
    return true
}

/**
 * TEMPORARY TRANSACTION ADAPTER — transactions are intentionally outside this
 * commit-engine migration. Preserve their established hook-free fast path and
 * positional call shape; only the effectful slow path delegates to the typed
 * bulk coordinator, which remains the sole owner of hook/error/notification
 * sequencing. This adapter can disappear when transactions are migrated as a
 * dedicated change.
 */
export const setAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    skipOnSet = false,
    report?: ChangeReport,
    hasCommitEffects = true,
) => {
    if (skipOnSet || !hasCommitEffects) {
        if (
            report === undefined &&
            pairs.size >= FRESH_ATOM_FAST_PATH_MIN &&
            tryWriteFreshSimpleAtoms(pairs, data)
        ) {
            return
        }
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

    commitAtoms(
        pairs,
        data,
        initializedAtomsSet,
        report ? { onSet: "collect", report } : BULK_WITH_EFFECTS_SILENT,
    )
}
