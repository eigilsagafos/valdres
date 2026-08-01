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

type UpdateSettlement = {
    kind: "update"
    atoms: Atom<any>[]
    settle: SettleFn
    flags: SettleFlags
}

type DeleteSettlement = {
    kind: "delete"
    atoms: AtomFamilyAtom<any, any>[]
    settle: (
        atoms: AtomFamilyAtom<any, any>[],
        data: StoreData,
        notify: NotifyTarget | undefined,
        report: ChangeReport | undefined,
    ) => void
}

type SelectorSettlement = {
    kind: "selector"
    selector: Selector<any>
    settle: SelectorSettleFn
}

/** A multi-root commit forest: every physical store appears in one canonical
 *  sparse tree node and settles exactly once against local, inherited, and
 *  global trigger groups. `globalUpdates` is populated by the engine after it
 *  applies the plan's ordered global effects. A single-store transaction with
 *  cleanup mutations is the degenerate one-entry, one-root case: its
 *  update/delete/unset writes are trigger GROUPS on one node, not passes. */
type CommitForestSettlement = {
    kind: "forest"
    entries: CommitForestEntry[]
    globalUpdates: StoreAtomUpdates | undefined
    settle: CommitForestSettleFn
}

type NoSettlement = {
    kind: "none"
}

type CommitSettlement =
    | UpdateSettlement
    | DeleteSettlement
    | SelectorSettlement
    | CommitForestSettlement
    | NoSettlement

export type PlannedGlobalEffects = {
    /** Ordered, finalized atom/value/origin descriptors. */
    sets: DeferredGlobalSet[]
    /** Metadata attached to peer reports from these effects. */
    source: StoreChangeSource
    /** Phase-two result populated by the engine before hooks run. */
    updates: StoreAtomUpdates | undefined
    apply: (sets: DeferredGlobalSet[], errors: CommitErrors) => StoreAtomUpdates
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
 * (global peer updates ride the settlement so the whole commit stays one
 * plan). Ordinary direct global writes, cleanup, reset, async resolution,
 * revalidation, and resetSelf all use the same forest owner when they affect
 * multiple stores.
 */
export type CommitPlan = {
    data: StoreData
    settlement: CommitSettlement
    /** Ordered global fan-out effects, applied by the engine after local values
     *  are final and before any hook or graph settlement. */
    globalEffects?: PlannedGlobalEffects
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
    /** Phase-6 delivery target (undefined = no onChange listener anywhere). */
    report: ChangeReport | undefined
    /** Operation-specific report preparation, executed by the shared engine. */
    beforeSettle?: (report: ChangeReport) => void
    /** Phase-8 cleanup, executed only after successful settlement. */
    afterSettle?: () => void
    /** Flush a report sink after settlement/cleanup. */
    flushReport?: () => void
    /** Optional outer commit boundary for standalone local operations. The
     *  token is the store TREE, which owns the depth counter and listeners. */
    beginCommit?: (data: StoreData) => StoreTreeRuntime
    endCommit?: (tree: StoreTreeRuntime, swallowErrors: boolean) => void
    /** Final lifecycle work that must occur after commit-end boundaries close
     *  but before the first captured error is rethrown (global resetSelf). */
    afterCommit?: () => void
    /** Hook errors normally do not starve later phases. Cleanup operations with
     *  no hooks use false to retain their historical short-circuit behavior. */
    continueAfterError?: boolean
}
