import type { Atom } from "../types/Atom"
import type { CommitPlan } from "../types/CommitPlan"
import type { SettleFn } from "../types/SettleFn"
import type { StoreData } from "../types/StoreData"
import { recordCommitPlanRun } from "./architectureInstrumentation"
import { recordCommitError, throwCommitError } from "./commitErrors"
import { SETTLE_DEFAULT } from "./commitIntents"
import { getStoreRuntime } from "./getStoreRuntime"
import { runOnSets } from "./runOnSets"

/**
 * The commit engine: the single owner of commit sequencing for the migrated
 * write shapes (ordinary direct writes, non-global bulk writes, local
 * reset/unset/delete operations, and single-store transaction commits). A
 * commit has nine phases; this header is the honest map of where each one
 * lives — the engine does NOT execute all nine itself:
 *
 *   1. Validate/normalize staged writes — in the coordinators: `setAtom`
 *      inline (updater resolve, schema, equality bail incl. the scope-shadow
 *      pin), `writeAtoms` per pair for bulk.
 *   2. Apply final values — synchronous coordinators inline; standalone async
 *      transitions through the plan's admitted `apply` callback.
 *   3. Run onSet behavior — OWNED HERE (`runHookedDirectWrite` for the single
 *      hooked write, `runOnSets` inside `runCommitPlan` for planned commits).
 *   4. Settle affected selectors      ┐
 *   5. Deliver subscribers            │ DELEGATED to the injected settlement
 *   6. Flush/buffer onChange           │ primitive. A standalone plan may defer
 *   7. Fire onCommitEnd               ┘ its flush and outer boundary to the
 *      engine when later phases must remain inside the same logical commit.
 *   8. Post-notification cleanup — OWNED HERE for plans that provide it. Local
 *      unset preserves its established order: re-delegate after subscribers
 *      but before the deferred onChange flush and outer commit-end callback.
 *   9. Rethrow the first captured error — OWNED HERE (hook-error preference
 *      for the single write; `CommitErrors` first-error for bulk).
 *
 * `settle` arrives by injection (a static function reference) rather than by
 * import so this module stays a leaf outside the core write-path import cycle
 * (see test/import-cycles) — the sequencer must not be hard-wired to the
 * propagation layer it sequences.
 *
 * Global and cross-scope transaction fan-out remain behind their existing
 * adapters. Async atom,
 * native async selector, and revalidation settlement enter this coordinator;
 * simple no-hook shapes use module-static entries from `createScalarCommit`
 * below; their bound operation owns any required apply, propagation,
 * observers, reporting, and local boundary.
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

// Module-level phase gates: runCommitPlan is on the per-commit hot path of
// every migrated write shape, so its guards must not allocate per run.
const settlementHasWork = (settlement: CommitPlan["settlement"]) =>
    settlement.kind === "none" ||
    settlement.kind === "selector" ||
    settlement.atoms.length > 0 ||
    (settlement.kind === "transaction" &&
        (settlement.deleted !== undefined || settlement.unset !== undefined))

const planShouldContinue = (plan: CommitPlan) =>
    plan.continueAfterError !== false || !plan.errors.hasError

/**
 * Execute a prepared local commit: phase 3 (deferred hooks, first error
 * retained) → optional pre-settle reporting → phases 4–7 (one typed settlement)
 * → phase 8 cleanup/deferred flush → phase 9 (first captured error rethrown).
 *
 * The settlement's non-empty atom-list guard is contractual, not an
 * optimization: a plan whose every write was value-equal must not settle.
 * Standalone reset may still own an explicit outer boundary because its public
 * historical behavior treats the reset call itself as a commit; ordinary bulk
 * plans do not, so their no-op trace remains empty.
 */
export const runCommitPlan = (plan: CommitPlan) => {
    const settlement = plan.settlement
    let commitRoot: StoreData | undefined
    let completed = false

    // Admission is deliberately the very first observable operation. A stale,
    // cancelled, or disposed async result cannot open a commit boundary or run
    // any user code merely by arriving late.
    if (plan.admit && !plan.admit()) return false
    recordCommitPlanRun(plan.data)
    if (plan.beginCommit) commitRoot = plan.beginCommit(plan.data)
    try {
        let applied = true
        if (plan.apply) {
            try {
                plan.apply()
            } catch (error) {
                applied = false
                recordCommitError(plan.errors, error)
            }
        }

        if (applied) runOnSets(plan.onSets, plan.errors)

        if (
            applied &&
            settlementHasWork(settlement) &&
            planShouldContinue(plan) &&
            plan.beforeSettle &&
            plan.report
        ) {
            try {
                plan.beforeSettle(plan.report)
            } catch (error) {
                recordCommitError(plan.errors, error)
            }
        }

        if (applied && settlementHasWork(settlement) && planShouldContinue(plan)) {
            try {
                if (settlement.kind === "update") {
                    settlement.settle(
                        settlement.atoms,
                        plan.data,
                        undefined,
                        plan.report,
                        settlement.flags,
                    )
                } else if (settlement.kind === "delete") {
                    settlement.settle(
                        settlement.atoms,
                        plan.data,
                        undefined,
                        plan.report,
                    )
                } else if (settlement.kind === "transaction") {
                    settlement.settle(
                        settlement.atoms,
                        settlement.deleted,
                        settlement.unset,
                        plan.data,
                        plan.report,
                        plan.errors,
                    )
                } else if (settlement.kind === "selector") {
                    settlement.settle(
                        settlement.selector,
                        plan.data,
                        plan.report,
                    )
                }
            } catch (error) {
                recordCommitError(plan.errors, error)
            }
        }

        if (applied && settlementHasWork(settlement) && planShouldContinue(plan) && plan.afterSettle) {
            try {
                plan.afterSettle()
            } catch (error) {
                recordCommitError(plan.errors, error)
            }
        }

        if (planShouldContinue(plan) && plan.flushReport) {
            try {
                plan.flushReport()
            } catch (error) {
                recordCommitError(plan.errors, error)
            }
        }
        completed = true
    } finally {
        if (commitRoot && plan.endCommit) {
            try {
                plan.endCommit(commitRoot, plan.errors.hasError || !completed)
            } catch (error) {
                recordCommitError(plan.errors, error)
            }
        }
    }

    throwCommitError(plan.errors)
    return true
}

/** Create an allocation-free coordinator entry for a final async transition
 * with no engine-owned hooks, deferred reports, or outer boundary. Callers bind
 * the static operation once at module initialization, producing a monomorphic
 * settlement call with no per-commit closure, plan, hook queue, or error
 * accumulator. The operation owns apply and any required propagation,
 * observers, reporting, and local boundary. `admitted` is evaluated immediately
 * before the synchronous operation, so no JavaScript work can interleave. */
export const createScalarCommit =
    <A, B, C, D, E, F>(
        operation: (a: A, b: B, c: C, d: D, e: E, f: F) => void,
    ) =>
    (admitted: boolean, a: A, b: B, c: C, d: D, e: E, f: F): boolean => {
        if (!admitted) return false
        operation(a, b, c, d, e, f)
        return true
    }

/** Create a scalar coordinator entry whose admission check can share the same
 * module-static, monomorphic call site as its operation. This keeps guarded
 * settlements allocation-free while ensuring the coordinator evaluates the
 * predicate immediately before applying the transition. */
export const createGuardedScalarCommit =
    <A, B, C, D, E, F>(
        admit: (a: A, b: B, c: C, d: D, e: E, f: F) => boolean,
        operation: (a: A, b: B, c: C, d: D, e: E, f: F) => void,
    ) =>
    (a: A, b: B, c: C, d: D, e: E, f: F): boolean => {
        if (!admit(a, b, c, d, e, f)) return false
        operation(a, b, c, d, e, f)
        return true
    }
