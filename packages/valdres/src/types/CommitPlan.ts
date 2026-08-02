import type { CommitErrors } from "../lib/commitErrors"
import type { StoreTreeRuntime } from "../lib/storeTreeRuntime"
import type {
    DeferredGlobalSet,
    StoreAtomUpdates,
} from "../lib/globalAtomFanOut"
import type { ChangeReport } from "../lib/notifyChangeListeners"
import type { NotifyTarget } from "../lib/propagateUpdatedAtoms"
import type { DeferredOnSet } from "../lib/runOnSets"
import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { SettleFlags } from "./SettleFlags"
import type { SettleFn } from "./SettleFn"
import type { Selector } from "./Selector"
import type { SelectorSettleFn } from "./SelectorSettleFn"
import type { StoreData } from "./StoreData"
import type {
    CommitForestEntry,
    CommitForestSettleFn,
} from "./CommitForestSettleFn"
import type { StoreChangeSource } from "./StoreChangeSource"

export type UpdateSettlement = {
    kind: "update"
    atoms: Atom<any>[]
    settle: SettleFn
    flags: SettleFlags
}

export type DeleteSettlement = {
    kind: "delete"
    atoms: AtomFamilyAtom<any, any>[]
    settle: (
        atoms: AtomFamilyAtom<any, any>[],
        data: StoreData,
        notify: NotifyTarget | undefined,
        report: ChangeReport | undefined,
    ) => void
}

export type SelectorSettlement = {
    kind: "selector"
    selector: Selector<any>
    settle: SelectorSettleFn
}

/** Apply every ordered global descriptor to its peers, returning the per-store
 *  atom groups the settlement must fold in. */
export type GlobalEffectsApply = (
    sets: DeferredGlobalSet[],
    errors: CommitErrors,
) => StoreAtomUpdates

/** Ordered global fan-out for one commit: the finalized atom/value/origin
 *  descriptors, the metadata attached to the resulting peer reports, and the
 *  application primitive. A plan that discovers its globals during its own
 *  write phase passes the queue it will fill. */
export type PlannedGlobalEffects = {
    sets: DeferredGlobalSet[]
    source: StoreChangeSource
    apply: GlobalEffectsApply
}

/** A multi-root commit forest: every physical store appears in one canonical
 *  sparse tree node and settles exactly once against local, inherited, and
 *  global trigger groups. A single-store transaction with cleanup mutations is
 *  the degenerate one-entry, one-root case: its update/delete/unset writes are
 *  trigger GROUPS on one node, not passes.
 *
 *  Global fan-out belongs to the forest and only to the forest — a commit whose
 *  peers span other stores is by definition multi-store. The two variants below
 *  make that the only expressible arrangement: without `global` there are no
 *  peer `globalUpdates` to fold in, and with it the engine populates them from
 *  `global.apply` before any hook or graph settlement runs. */
export type LocalForestSettlement = {
    kind: "forest"
    entries: CommitForestEntry[]
    global: undefined
    globalUpdates: undefined
    settle: CommitForestSettleFn
}

export type GlobalForestSettlement = {
    kind: "forest"
    entries: CommitForestEntry[]
    global: PlannedGlobalEffects
    /** Phase-two result, populated by the engine before hooks run. */
    globalUpdates: StoreAtomUpdates | undefined
    settle: CommitForestSettleFn
}

export type CommitForestSettlement =
    | LocalForestSettlement
    | GlobalForestSettlement

export type NoSettlement = {
    readonly kind: "none"
}

export type CommitSettlement =
    | UpdateSettlement
    | DeleteSettlement
    | SelectorSettlement
    | CommitForestSettlement
    | NoSettlement

/** The outer commit boundary of a standalone local operation, as ONE
 *  capability: `begin` and `end` are inseparable, so a plan cannot open a
 *  boundary it never closes (or promise to close one it never opened). The
 *  token is the store TREE, which owns the depth counter and listeners.
 *
 *  `end` takes `didWork` because a boundary that wraps its own write phase
 *  cannot know at `begin` whether the commit will produce anything; a false
 *  answer closes the boundary without announcing a commit. */
export type CommitBoundary = {
    begin: (data: StoreData) => StoreTreeRuntime
    end: (
        tree: StoreTreeRuntime,
        swallowErrors: boolean,
        didWork: boolean,
    ) => void
}

/**
 * A normalized local commit executed by `runCommitPlan`. Most plans are built
 * after phases 1–2; `apply` lets a standalone operation whose historical
 * lifecycle boundary already covered its write phase (direct reset) keep that
 * exact boundary without moving observer sequencing back into its entry point.
 *
 * `settlement` is a typed description of an existing propagation primitive.
 * Update/reset/unset plans use `settleCommit` with shared `SettleFlags`;
 * deletion uses `settleDeletedCommit`; every transaction commit carrying
 * cleanup mutations — single-store or cross-scope — uses `settleCommitForest`;
 * native async selectors use their downstream-only settlement; guarded cleanup
 * uses `kind: "none"`.
 *
 * Optional phase callbacks stay declarative: the engine owns their order.
 * `beforeSettle` lets unset prepend its distinct removal change record;
 * `afterSettle` performs post-notification cleanup such as scope subscription
 * re-delegation; `flushReport` drains a deliberately deferred onChange sink.
 * The callbacks are absent from ordinary bulk plans.
 *
 * Scope note: most plans model one store and one settlement. Anything whose
 * settlement spans more than one trigger group — a cross-scope transaction, a
 * commit with global peers, or a single-store transaction mixing updates with
 * deletes/unsets — models its affected stores through the `forest` settlement
 * (global peer updates ride the settlement, so the whole commit stays one
 * plan). Ordinary direct global writes, cleanup, reset, async resolution,
 * revalidation, and resetSelf all use the same forest owner when they affect
 * multiple stores.
 *
 * Plans are deliberately MUTABLE: the hot shapes reuse one module-static plan
 * graph per commit, and the engine writes phase-two results back into the
 * settlement. Legality is therefore enforced by construction (see
 * `lib/commitPlans.ts`) and re-checked by the dev-only `assertPlanLegal`, not
 * by freezing.
 */
type CommitPlanShared = {
    data: StoreData
    settlement: CommitSettlement
    /** Final stale/cancel/dispose admission check. A false result is a total
     *  no-op: no boundary, apply, hook, settlement, report, or cleanup runs. */
    admit?: () => boolean
    /** Optional phases 1–2 callback. An apply error skips hooks/settlement but
     *  still permits a deferred sink/boundary to finish best-effort. */
    apply?: () => void
    /** Phase-3 queue collected by the write phase. */
    onSets: DeferredOnSet[]
    /** First-error accumulator threaded through phases 3–8; phase 9 rethrows. */
    errors: CommitErrors
    /** Phase-8 cleanup, executed only after successful settlement. */
    afterSettle?: () => void
    /** Flush a report sink after settlement/cleanup. */
    flushReport?: () => void
    /** Optional paired outer commit boundary for standalone local operations. */
    boundary?: CommitBoundary
    /** Final lifecycle work that must occur after commit-end boundaries close
     *  but before the first captured error is rethrown (global resetSelf). */
    afterCommit?: () => void
    /** Hook errors normally do not starve later phases. Cleanup operations with
     *  no hooks use false to retain their historical short-circuit behavior. */
    continueAfterError?: boolean
}

/** The ordinary plan: it may or may not have an onChange delivery target, and
 *  it never prepares its own record. */
export type UnreportedCommitPlan = CommitPlanShared & {
    /** Phase-6 delivery target (undefined = no onChange listener anywhere). */
    report: ChangeReport | undefined
    beforeSettle?: undefined
}

/** A plan whose operation contributes its own change record before settlement.
 *  `beforeSettle` receives the report, so the delivery target is REQUIRED — an
 *  optional one would silently discard the preparation. */
export type ReportingCommitPlan = CommitPlanShared & {
    report: ChangeReport
    /** Operation-specific report preparation, executed by the shared engine. */
    beforeSettle: (report: ChangeReport) => void
}

export type CommitPlan = UnreportedCommitPlan | ReportingCommitPlan
