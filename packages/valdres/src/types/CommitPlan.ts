import type { CommitErrors } from "../lib/commitErrors"
import type { StoreAtomUpdates } from "../lib/globalAtomFanOut"
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
import type { TransactionSettleFn } from "./TransactionSettleFn"
import type {
    TransactionTreeEntry,
    TransactionTreeSettleFn,
} from "./TransactionTreeSettleFn"

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

/** A single-store transaction commit with cleanup mutations: updated atoms,
 *  deleted family members, and unset atoms settle as one deferred-notification
 *  unit. `deleted`/`unset` are undefined (never empty) when absent so the
 *  engine's has-work guard stays a plain presence check. */
type TransactionSettlement = {
    kind: "transaction"
    atoms: Atom<any>[]
    deleted: AtomFamilyAtom<any, any>[] | undefined
    unset: Atom<any>[] | undefined
    settle: TransactionSettleFn
}

/** A cross-scope transaction commit: the whole affected store tree settles as
 *  one root-first walk, each store exactly once against the union of its own
 *  writes and inherited changes. `entries` is the flat root-first plan;
 *  `globalUpdates` is undefined (never empty) when no global peer changed. */
type TransactionTreeSettlement = {
    kind: "transactionTree"
    entries: TransactionTreeEntry[]
    globalUpdates: StoreAtomUpdates | undefined
    settle: TransactionTreeSettleFn
}

type NoSettlement = {
    kind: "none"
}

type CommitSettlement =
    | UpdateSettlement
    | DeleteSettlement
    | SelectorSettlement
    | TransactionSettlement
    | TransactionTreeSettlement
    | NoSettlement

/**
 * A normalized local commit executed by `runCommitPlan`. Most plans are built
 * after phases 1–2; `apply` lets a standalone operation whose historical
 * lifecycle boundary already covered its write phase (direct reset) keep that
 * exact boundary without moving observer sequencing back into its entry point.
 *
 * `settlement` is a typed description of an existing propagation primitive.
 * Update/reset/unset plans use `settleCommit` with shared `SettleFlags`;
 * deletion uses `settleDeletedCommit`; a single-store transaction commit with
 * cleanup mutations uses `settleTransactionCommit`; a cross-scope transaction
 * commit uses `settleTransactionTreeCommit`; native async selectors use their
 * downstream-only settlement; guarded cleanup uses `kind: "none"`.
 *
 * Optional phase callbacks stay declarative: the engine owns their order.
 * `beforeSettle` lets unset prepend its distinct removal change record;
 * `afterSettle` performs post-notification cleanup such as scope subscription
 * re-delegation; `flushReport` drains a deliberately deferred onChange sink.
 * The callbacks are absent from ordinary bulk plans.
 *
 * Scope note: most plans model one store and one settlement — including
 * single-store transaction commits, whose finalized overlay translates into a
 * plan. A cross-scope transaction commit models the whole affected store tree
 * through the `transactionTree` settlement (its global peer updates ride the
 * settlement so the entire commit stays one plan). Ordinary direct global
 * writes and single-store global cleanup remain behind their adapters; async
 * global settlement delegates its multi-store phase without adding a local
 * begin/end boundary.
 */
export type CommitPlan = {
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
