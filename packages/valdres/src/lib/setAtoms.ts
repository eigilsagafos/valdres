import type { Atom } from "../types/Atom"
import type { BulkWriteIntent } from "../types/CommitIntent"
import type { UnreportedCommitPlan } from "../types/CommitPlan"
import type { InternalAtom } from "../types/InternalAtom"
import type { StoreData } from "../types/StoreData"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import { runCommitPlan } from "./commitEngine"
import { SETTLE_DEFAULT } from "./commitIntents"
import { createCommitErrors } from "./commitErrors"
import {
    createCommitPlan,
    globalEffects,
    forestSettlement,
    singleStoreForest,
    updateSettlement,
} from "./commitPlans"
import { equal } from "./equal"
import { applyGlobalSets, collectGlobalOnSets } from "./globalAtomFanOut"
import { flushChangeSink, type ChangeSink } from "./notifyChangeListeners"
import { activeCommitBoundary, hasCommitEndListener } from "./onCommitEnd"
import { settleCommit, settleCommitForest } from "./propagateUpdatedAtoms"
import type { DeferredOnSet } from "./runOnSets"
import { setValueInData } from "./setValueInData"
import { writeAtoms } from "./writeAtoms"

// Safe only with writeAtoms("skip"), which cannot mutate this queue.
// Reusing it keeps hook-free bulk writes allocation-light.
const noOnSets: DeferredOnSet[] = []
// Exported for the fast path's own tests, which have to straddle the threshold
// to compare the specialization against the established path — a hardcoded
// batch size would silently take the established path on both sides if this
// number ever moved, and the differential would pass by being vacuous.
export const FRESH_ATOM_FAST_PATH_MIN = 256

/**
 * Bulk-write coordinator of the commit engine, invoked directly by a
 * single-store transaction commit whose overlay stages effectful writes but no
 * cleanup mutations. Phases 1–2 run through writeAtoms; an explicitly hook-free
 * intent settles immediately (allocation-free — shared empty queue, shared
 * frozen flags); a hooked non-global commit runs phases 3–9 through
 * runCommitPlan. Global peer values are applied before that plan begins and
 * ride the same canonical commit forest as the origin write.
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
    // peer has been attempted do user hooks run. CommitPlan owns that phase-two
    // application and exposes the resulting per-store trigger groups to its
    // forest settlement.
    const globalSets = collectGlobalOnSets(onSets)

    if (!globalSets) {
        runCommitPlan(
            createCommitPlan(
                data,
                updateSettlement(
                    data,
                    updatedAtoms,
                    settleCommit,
                    SETTLE_DEFAULT,
                ),
                onSets,
                errors,
                intent.report,
            ),
        )
        return
    }
    runCommitPlan(
        createCommitPlan(
            data,
            forestSettlement(
                data,
                singleStoreForest(data, updatedAtoms),
                globalEffects(data, globalSets, "set", applyGlobalSets),
                settleCommitForest,
            ),
            onSets,
            errors,
            intent.report,
        ),
    )
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
    // this specialization exists to avoid. The specialization produces no
    // settlement list, so a listener on this tree needs the full path to make
    // the commit engine observe the completed work and close its boundary.
    if (
        data.parent ||
        pairs.size < FRESH_ATOM_FAST_PATH_MIN ||
        hasCommitEndListener(data)
    )
        return false
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
            data.tree.trackedRevisions?.has(atom) ||
            data.inheritedDependencyBranches.has(atom) ||
            (atom as InternalAtom).onInit !== undefined
        ) {
            return false
        }
    }
    for (const [atom, value] of pairs) {
        // The established path's per-atom sequence for a fresh atom — land the
        // declared default (initAtom), run the atom's comparator, write — kept
        // here for FAILURE fidelity, not for the comparison's answer: admission
        // proved nothing is committed yet, so an equal answer has no prior
        // value to preserve by skipping the write. Whichever of the two steps
        // after the landing throws, the atom is left holding its default,
        // exactly as initAtom plus a failed set leaves it.
        //
        // Neither step is dead, though `equal` alone is inert on a
        // primitive-or-null first operand (it answers from `===` without
        // reaching an object path, so the incoming value's valueOf/toString are
        // never invoked). What keeps them live is that this loop runs USER CODE
        // between iterations: in a dev build setValueInData deep-freezes the
        // staged value, and deepFreeze reads every own property, so a getter in
        // an EARLIER atom's value can reassign a later atom's `equal` (atoms
        // are plain objects), swap its `defaultValue` for an object whose
        // coercion hooks then DO run, or fail its own second traversal.
        // Admission's per-atom checks are therefore facts about loop entry, not
        // about iteration N. Re-reading `atom.equal` and `atom.defaultValue`
        // here — rather than hoisting them — is what keeps those two cases in
        // step with the established path.
        //
        // Fidelity under such a mutation is deliberately NOT claimed in
        // general. The landing is a bare `values.set`, not `initAtom`, so the
        // duties initAtom performs around it are not reproduced: a `schema`
        // assigned mid-loop never validates the default, and an `onInit`
        // assigned mid-loop is never invoked (both diverge from the established
        // path, both pinned as known divergences in setAtoms.test.ts). Closing
        // that class properly means removing the user-code window rather than
        // re-checking fields per atom — admitting only primitive VALUES would
        // do it, since setValueInData then freezes nothing and the loop calls
        // nothing. That is a scope/perf tradeoff for its own change.
        data.values.set(atom, atom.defaultValue)
        atom.equal(atom.defaultValue, value)
        setValueInData(atom, value, data)
    }
    return true
}

// ——— Reusable hook-free transaction plan ———
// The dominant transaction shape (no hooks, no cleanup mutations) commits
// through runCommitPlan with ZERO per-commit allocations: one module-static
// plan/settlement/errors trio plus static apply/flush operations reading
// module-static arguments — the plan-shaped sibling of the engine's
// `createScalarCommit` entries. At most one such commit is in flight per
// synchronous frame in the common case; a nested commit (a subscriber opening
// a new transaction while an outer commit is delivering) finds the statics
// busy and falls back to a fresh plan. Every field is reset in `finally` so
// the statics never retain a store, sink, or atom list past their commit.
// This is deliberately engine-copy-local scratch, not StoreData semantics:
// each Store facade closes over the transaction engine that created it, while
// a nested call through another adopted copy gets that copy's independent
// busy flag and carrier rather than clobbering this frame.
const EMPTY_UPDATED_ATOMS: Atom<any>[] = []
let hookFreeBusy = false
let hookFreePairs: Map<Atom<any>, any> = undefined!
let hookFreeData: StoreData = undefined!
let hookFreeInitialized: Set<Atom> = undefined!
let hookFreeSink: ChangeSink | undefined

const hookFreeSettlement = updateSettlement(
    undefined,
    EMPTY_UPDATED_ATOMS,
    settleCommit,
    SETTLE_DEFAULT,
)

const hookFreeApply = () => {
    if (
        hookFreeSink === undefined &&
        hookFreePairs.size >= FRESH_ATOM_FAST_PATH_MIN &&
        tryWriteFreshSimpleAtoms(hookFreePairs, hookFreeData)
    ) {
        return
    }
    // Assigned (not pushed) so a large batch pays no second copy.
    hookFreeSettlement.atoms = writeAtoms(
        hookFreePairs,
        hookFreeData,
        hookFreeInitialized,
        "skip",
        noOnSets,
    )
}

const hookFreeFlushReport = () => flushChangeSink(hookFreeSink!)

const hookFreeErrors = createCommitErrors()

const hookFreePlan: UnreportedCommitPlan = createCommitPlan(
    undefined as unknown as StoreData,
    hookFreeSettlement,
    noOnSets,
    hookFreeErrors,
    undefined,
    undefined,
    undefined,
    hookFreeApply,
)

/**
 * Hook-free bulk commit entry, invoked directly by a single-store transaction
 * commit whose overlay carries no onSet-bearing atoms (and therefore no
 * globals — every global atom carries a marker hook) and no cleanup
 * mutations. The whole commit is one CommitPlan: the write phase runs as the
 * plan's `apply` (inside the boundary, exactly where the historical inline
 * sequencing put it), settlement is the shared update primitive, and the plan
 * owns the outer commit-end boundary and the deferred onChange flush. Large
 * unobserved initialization batches take the fresh-atom specialization above
 * as the apply fast path. Sharing the frozen empty onSet queue is safe:
 * writeAtoms("skip") never enqueues, and runOnSets only reads.
 */
export const commitHookFreeAtoms = (
    pairs: Map<Atom<any>, any>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    sink: ChangeSink | undefined,
) => {
    if (hookFreeBusy) {
        // Nested hook-free commit: the statics are mid-flight for the outer
        // commit, so this (rare) shape pays the per-commit plan allocation.
        const settlement = updateSettlement(
            data,
            [] as Atom<any>[],
            settleCommit,
            SETTLE_DEFAULT,
        )
        runCommitPlan(
            createCommitPlan(
                data,
                settlement,
                noOnSets,
                createCommitErrors(),
                sink,
                undefined,
                undefined,
                () => {
                    if (
                        sink === undefined &&
                        pairs.size >= FRESH_ATOM_FAST_PATH_MIN &&
                        tryWriteFreshSimpleAtoms(pairs, data)
                    ) {
                        return
                    }
                    settlement.atoms = writeAtoms(
                        pairs,
                        data,
                        initializedAtomsSet,
                        "skip",
                        noOnSets,
                    )
                },
                undefined,
                sink ? () => flushChangeSink(sink) : undefined,
                activeCommitBoundary(),
            ),
        )
        return
    }
    hookFreeBusy = true
    hookFreePairs = pairs
    hookFreeData = data
    hookFreeInitialized = initializedAtomsSet
    hookFreeSink = sink
    hookFreePlan.data = data
    hookFreePlan.report = sink
    hookFreePlan.flushReport =
        sink === undefined ? undefined : hookFreeFlushReport
    hookFreePlan.boundary = activeCommitBoundary()
    try {
        runCommitPlan(hookFreePlan)
    } finally {
        hookFreeBusy = false
        hookFreePairs = undefined!
        hookFreeData = undefined!
        hookFreeInitialized = undefined!
        hookFreeSink = undefined
        hookFreeSettlement.atoms = EMPTY_UPDATED_ATOMS
        hookFreePlan.data = undefined as unknown as StoreData
        hookFreePlan.report = undefined
        hookFreePlan.flushReport = undefined
        hookFreePlan.boundary = undefined
        hookFreeErrors.hasError = false
        hookFreeErrors.firstError = undefined
    }
}
