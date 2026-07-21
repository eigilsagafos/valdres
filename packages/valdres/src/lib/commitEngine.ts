import type { Atom } from "../types/Atom"
import type { CommitPlan } from "../types/CommitPlan"
import type { SettleFn } from "../types/SettleFn"
import type { StoreData } from "../types/StoreData"
import { recordCommitError, throwCommitError } from "./commitErrors"
import { SETTLE_DEFAULT } from "./commitIntents"
import { getStoreRuntime } from "./getStoreRuntime"
import { runOnSets } from "./runOnSets"

/**
 * The commit engine: the single owner of commit sequencing for the migrated
 * write shapes (ordinary direct writes and non-global bulk writes). A commit
 * has nine phases; this header is the honest map of where each one lives —
 * the engine does NOT execute all nine itself:
 *
 *   1. Validate/normalize staged writes — in the coordinators: `setAtom`
 *      inline (updater resolve, schema, equality bail incl. the scope-shadow
 *      pin), `writeAtoms` per pair for bulk.
 *   2. Apply final values — same coordinators, via `setValueInData` +
 *      `resolvePendingDefault`.
 *   3. Run onSet behavior — OWNED HERE (`runHookedDirectWrite` for the single
 *      hooked write, `runOnSets` inside `runCommitPlan` for bulk).
 *   4. Settle affected selectors      ┐
 *   5. Deliver subscribers            │ DELEGATED to the injected `settle`
 *   6. Flush onChange                 │ composite (statically `settleCommit`),
 *   7. Fire onCommitEnd               ┘ whose internal begin/endCommit bracket
 *      and onChange emit/buffer placement are deliberately not interposable in
 *      this iteration — the trace oracle locks their positions.
 *   8. Post-notification cleanup — VACANT for migrated shapes. It exists on
 *      the unmigrated paths (`reDelegateScopeSubscriptions` after unset/txn
 *      notify) and stays owned there; the slot is documented so its later
 *      migration lands here, not in an adapter.
 *   9. Rethrow the first captured error — OWNED HERE (hook-error preference
 *      for the single write; `CommitErrors` first-error for bulk).
 *
 * `settle` arrives by injection (a static function reference) rather than by
 * import so this module stays a leaf outside the core write-path import cycle
 * (see test/import-cycles) — the sequencer must not be hard-wired to the
 * propagation layer it sequences.
 *
 * Unmigrated writers (transaction commitWork branches, async settlement,
 * global fan-out, unset/delete/reset) keep their own historical sequencing
 * behind clearly-marked adapters; none of it is duplicated here.
 */

/**
 * One settled non-global write that carries a user onSet hook: phase 3 (run
 * the hook, capturing its error) → phases 4–7 (`settle` always runs — a
 * throwing hook must not starve propagation of an applied write) → phase 9
 * (the hook error is rethrown preferentially over a settle error).
 * Byte-equivalent to the historical non-global branch of `finishAtomSet`.
 */
export const runHookedDirectWrite = <Value>(
    atom: Atom<Value>,
    value: Value,
    data: StoreData,
    updatedAtoms: Atom<any>[],
    report: "set" | "async-set",
    settle: SettleFn,
) => {
    let hasHookError = false
    let hookError: unknown
    try {
        atom.onSet!(value, getStoreRuntime(data))
    } catch (error) {
        hasHookError = true
        hookError = error
    }
    try {
        settle(updatedAtoms, data, undefined, report, SETTLE_DEFAULT)
    } catch (error) {
        if (hasHookError) throw hookError
        throw error
    }
    if (hasHookError) throw hookError
}

/**
 * Execute a prepared non-global bulk commit: phase 3 (deferred hooks, first
 * error retained) → phases 4–7 (settle; its error is recorded, never
 * interrupting) → phase 9 (first captured error rethrown).
 *
 * The `updatedAtoms.length > 0` guard is contractual, not an optimization: a
 * commit whose every write was value-equal must not settle — settling would
 * open a commit-end boundary and fire a spurious `commitEnd` on a no-op commit
 * (the trace oracle requires a no-op to produce zero events).
 */
export const runCommitPlan = (plan: CommitPlan) => {
    runOnSets(plan.onSets, plan.errors)
    if (plan.updatedAtoms.length > 0) {
        try {
            plan.settle(
                plan.updatedAtoms,
                plan.data,
                undefined,
                plan.report,
                SETTLE_DEFAULT,
            )
        } catch (error) {
            recordCommitError(plan.errors, error)
        }
    }
    throwCommitError(plan.errors)
}
