import type { CommitErrors } from "../lib/commitErrors"
import type { ChangeReport } from "../lib/notifyChangeListeners"
import type { NotifyTarget } from "../lib/propagateUpdatedAtoms"
import type { DeferredOnSet } from "../lib/runOnSets"
import type { Atom } from "./Atom"
import type { AtomFamilyAtom } from "./AtomFamilyAtom"
import type { SettleFlags } from "./SettleFlags"
import type { SettleFn } from "./SettleFn"
import type { StoreData } from "./StoreData"

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

type CommitSettlement = UpdateSettlement | DeleteSettlement

/**
 * A normalized local commit executed by `runCommitPlan`. Most plans are built
 * after phases 1–2; `apply` lets a standalone operation whose historical
 * lifecycle boundary already covered its write phase (direct reset) keep that
 * exact boundary without moving observer sequencing back into its entry point.
 *
 * `settlement` is a typed description of the existing propagation primitive,
 * not an operation-specific observer pipeline. Update/reset/unset plans use
 * `settleCommit` with one of the shared `SettleFlags`; deletion plans use the
 * typed `settleDeletedCommit` wrapper around the established delete primitive.
 *
 * Optional phase callbacks stay declarative: the engine owns their order.
 * `beforeSettle` lets unset prepend its distinct removal change record;
 * `afterSettle` performs post-notification cleanup such as scope subscription
 * re-delegation; `flushReport` drains a deliberately deferred onChange sink.
 * The callbacks are absent from ordinary bulk plans.
 *
 * Scope note: this still models a SINGLE-STORE, SINGLE-SETTLEMENT commit.
 * Cross-scope transactions and global fan-out remain behind their temporary
 * adapters until their dedicated migrations.
 */
export type CommitPlan = {
    data: StoreData
    settlement: CommitSettlement
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
    /** Optional outer commit boundary for standalone local operations. */
    beginCommit?: (data: StoreData) => StoreData
    endCommit?: (root: StoreData, swallowErrors: boolean) => void
    /** Hook errors normally do not starve later phases. Cleanup operations with
     *  no hooks use false to retain their historical short-circuit behavior. */
    continueAfterError?: boolean
}
