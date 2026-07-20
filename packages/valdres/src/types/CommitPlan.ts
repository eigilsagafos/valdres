import type { CommitErrors } from "../lib/commitErrors"
import type { ChangeReport } from "../lib/notifyChangeListeners"
import type { DeferredOnSet } from "../lib/runOnSets"
import type { Atom } from "./Atom"
import type { SettleFn } from "./SettleFn"
import type { StoreData } from "./StoreData"

/**
 * A validated, applied, non-global bulk commit awaiting phases 3–9 (run onSet
 * hooks → settle/deliver/flush via `settle` → rethrow first error). Built by
 * `setAtoms` AFTER the write phase (phases 1–2, `writeAtoms`) and after global
 * fan-out has been ruled out; executed by `runCommitPlan`.
 *
 * Allocated only on the hooked slow path — never for ordinary direct writes or
 * plain (hook-free) bulk writes.
 *
 * Scope note: this models a SINGLE-STORE, SINGLE-SETTLE commit. Absorbing the
 * remaining transaction shapes (cross-scope trees, deletes/unsets, global
 * fan-out) later requires growing a deferred multi-store notify concept here —
 * deliberately future work, not smuggled in.
 */
export type CommitPlan = {
    data: StoreData
    /** Atoms whose value actually changed, merged with any atoms lazily
     *  initialized during the write phase's equality reads. */
    updatedAtoms: Atom<any>[]
    /** Phase-3 queue collected by the write phase. */
    onSets: DeferredOnSet[]
    /** First-error accumulator threaded through phases 3–7; phase 9 rethrows. */
    errors: CommitErrors
    /** The settle composite (statically `settleCommit`), injected so the engine
     *  stays out of the propagation import cycle. */
    settle: SettleFn
    /** Phase-6 delivery target (undefined = no onChange listener anywhere). */
    report: ChangeReport | undefined
}
