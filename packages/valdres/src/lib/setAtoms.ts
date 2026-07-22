import type { Atom } from "../types/Atom"
import type { BulkWriteIntent } from "../types/CommitIntent"
import type { CommitPlan } from "../types/CommitPlan"
import type { InternalAtom } from "../types/InternalAtom"
import type { StoreData } from "../types/StoreData"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import { runCommitPlan } from "./commitEngine"
import { SETTLE_DEFAULT } from "./commitIntents"
import { createCommitErrors } from "./commitErrors"
import { equal } from "./equal"
import { applyGlobalSets, collectGlobalOnSets } from "./globalAtomFanOut"
import { flushChangeSink, type ChangeSink } from "./notifyChangeListeners"
import { beginCommit, commitEndRegistry, endCommit } from "./onCommitEnd"
import { settleCommit, settleCommitForest } from "./propagateUpdatedAtoms"
import type { DeferredOnSet } from "./runOnSets"
import { setValueInData } from "./setValueInData"
import { writeAtoms } from "./writeAtoms"

// Safe only with writeAtoms("skip"), which cannot mutate this queue.
// Reusing it keeps hook-free bulk writes allocation-light.
const noOnSets: DeferredOnSet[] = []
const FRESH_ATOM_FAST_PATH_MIN = 256

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
        runCommitPlan({
            data,
            settlement: {
                kind: "update",
                atoms: updatedAtoms,
                settle: settleCommit,
                flags: SETTLE_DEFAULT,
            },
            onSets,
            errors,
            report: intent.report,
        })
        return
    }
    runCommitPlan({
        data,
        globalEffects: {
            sets: globalSets,
            source: "set",
            updates: undefined,
            apply: applyGlobalSets,
        },
        settlement: {
            kind: "forest",
            entries: [
                {
                    data,
                    updatedAtoms,
                    deleted: undefined,
                    unsetAtoms: undefined,
                    children: undefined,
                },
            ],
            globalUpdates: undefined,
            settle: settleCommitForest,
        },
        onSets,
        errors,
        report: intent.report,
    })
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
const EMPTY_UPDATED_ATOMS: Atom<any>[] = []
let hookFreeBusy = false
let hookFreePairs: Map<Atom<any>, any> = undefined!
let hookFreeData: StoreData = undefined!
let hookFreeInitialized: Set<Atom> = undefined!
let hookFreeSink: ChangeSink | undefined

const hookFreeSettlement = {
    kind: "update" as const,
    atoms: EMPTY_UPDATED_ATOMS,
    settle: settleCommit,
    flags: SETTLE_DEFAULT,
}

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

const hookFreePlan: CommitPlan = {
    data: undefined as unknown as StoreData,
    settlement: hookFreeSettlement,
    apply: hookFreeApply,
    onSets: noOnSets,
    errors: hookFreeErrors,
    report: undefined,
    flushReport: undefined,
    beginCommit: undefined,
    endCommit: undefined,
}

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
        const settlement = {
            kind: "update" as const,
            atoms: [] as Atom<any>[],
            settle: settleCommit,
            flags: SETTLE_DEFAULT,
        }
        runCommitPlan({
            data,
            settlement,
            apply: () => {
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
            onSets: noOnSets,
            errors: createCommitErrors(),
            report: sink,
            flushReport: sink ? () => flushChangeSink(sink) : undefined,
            beginCommit:
                commitEndRegistry.count === 0 ? undefined : beginCommit,
            endCommit: commitEndRegistry.count === 0 ? undefined : endCommit,
        })
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
    const withBoundary = commitEndRegistry.count !== 0
    hookFreePlan.beginCommit = withBoundary ? beginCommit : undefined
    hookFreePlan.endCommit = withBoundary ? endCommit : undefined
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
        hookFreePlan.beginCommit = undefined
        hookFreePlan.endCommit = undefined
        hookFreeErrors.hasError = false
        hookFreeErrors.firstError = undefined
    }
}
