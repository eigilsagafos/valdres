import type { Atom } from "../types/Atom"
import type { CommitForestEntry } from "../types/CommitForestSettleFn"
import type { CommitPlan } from "../types/CommitPlan"
import type { SettleFn } from "../types/SettleFn"
import type { StoreData } from "../types/StoreData"
import type { StoreTreeRuntime } from "./storeTreeRuntime"
import { recordCommitPlanRun } from "./architectureInstrumentation"
import { recordCommitError, throwCommitError } from "./commitErrors"
import { SETTLE_DEFAULT } from "./commitIntents"
import { assertPlanLegal } from "./commitPlans"
import { getStoreRuntime } from "./getStoreRuntime"
import { IS_PROD } from "./IS_PROD"
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
 * Transaction commits carrying cleanup mutations enter the engine through the
 * commit-forest settlement (global peer updates ride the settlement, so each
 * multi-store unit is one plan) — a non-global single-store one as a
 * single-entry forest, so no shape needs a multi-pass composer of its own.
 * Async atom, native async selector, and
 * revalidation settlement enter this coordinator; simple no-hook shapes use
 * module-static entries from
 * `createScalarCommit` below; their bound operation owns any required apply,
 * propagation, observers, reporting, and local boundary.
 */

/**
 * One settled non-global write that carries a user onSet hook: phase 3 (run
 * the hook, capturing its error) → phases 4–7 (`settle` always runs — a
 * throwing hook must not starve propagation of an applied write) → phase 9
 * (the hook error is rethrown preferentially over a settle error).
 * The allocation-free non-global direct-write path.
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
const treeHasWork = (entries: CommitForestEntry[]) => {
    for (const entry of entries) {
        // Every group is now non-empty-or-absent, so all three trigger kinds
        // answer "is there work here" the same way.
        if (
            entry.updatedAtoms.length > 0 ||
            entry.deleted !== undefined ||
            entry.unsetAtoms !== undefined
        ) {
            return true
        }
    }
    return false
}

const settlementHasWork = (settlement: CommitPlan["settlement"]) =>
    settlement.kind === "none" ||
    settlement.kind === "selector" ||
    (settlement.kind === "forest"
        ? // Changed global peers are settlement work even when every write in
          // the local tree was value-equal.
          settlement.globalUpdates !== undefined ||
          treeHasWork(settlement.entries)
        : settlement.atoms.length > 0)

const planShouldContinue = (plan: CommitPlan) =>
    plan.continueAfterError !== false || !plan.errors.hasError

/**
 * Execute a prepared local commit: phase 3 (deferred hooks, first error
 * retained) → optional pre-settle reporting → phases 4–7 (one typed settlement)
 * → phase 8 cleanup/deferred flush → phase 9 (first captured error rethrown).
 *
 * The settlement's non-empty atom-list guard is contractual, not an
 * optimization: a plan whose every write was value-equal must not settle. It is
 * evaluated ONCE per commit — settlement work is final as soon as `apply` and
 * global fan-out have run — and the same answer gates report preparation,
 * settlement, and post-notification cleanup.
 *
 * A plan with nothing to apply, fan out, run, settle, or flush is not a commit
 * at all: it opens no boundary, so it cannot fire `onCommitEnd` for a commit
 * that never happened. Standalone reset may still own an explicit outer
 * boundary because its public historical behavior treats the reset call itself
 * as a commit; ordinary bulk plans do not, so their no-op trace remains empty.
 */
// Declared at module scope (not global) so we don't conflict with a
// consumer's @types/node or bun-types — mirroring src/lib/IS_PROD.ts.
declare const process: { env: { VALDRES_ENGINE_SELF_CHECKS?: string } }

export const runCommitPlan = (plan: CommitPlan) => {
    // Engine self-check. A CommitPlan is never built by user code, so an
    // illegal one is a bug in THIS package — the audience is valdres
    // development, not a consumer's dev build. `build.ts` therefore defines
    // `process.env.VALDRES_ENGINE_SELF_CHECKS` as "off", which folds this to
    // `if (!IS_PROD && false)`; a consumer's bundler drops the branch and
    // tree-shakes `assertPlanLegal` and its whole graph, so consumers pay
    // nothing at all. The env read is written INLINE rather than behind a
    // shared const because only the inline form folds — bundlers do not
    // propagate a module-level boolean into this branch. Running against
    // `src/` leaves the flag unset, so this repo's own test suite checks every
    // plan the engine executes. `!IS_PROD` is first so the benchmark lane,
    // which runs `src/` under NODE_ENV=production, short-circuits before the
    // per-commit `process.env` read and measures what the dist does.
    if (!IS_PROD && process.env.VALDRES_ENGINE_SELF_CHECKS !== "off")
        assertPlanLegal(plan)

    // Admission is deliberately the very first observable operation. A stale,
    // cancelled, or disposed async result cannot open a commit boundary or run
    // any user code merely by arriving late.
    if (plan.admit && !plan.admit()) return false
    recordCommitPlanRun(plan.data)

    const settlement = plan.settlement
    const boundary = plan.boundary
    // The only settlement that owns global fan-out — narrowed once so both the
    // phase-two write-back and the settle dispatch stay monomorphic.
    const globalForest =
        settlement.kind === "forest" && settlement.global !== undefined
            ? settlement
            : undefined
    // Settlement work is fixed once apply and global fan-out have run. A plan
    // with neither is already final at entry, so its single evaluation happens
    // here and also answers the boundary question below.
    const workIsFinal = plan.apply === undefined && globalForest === undefined
    let hasWork = workIsFinal ? settlementHasWork(settlement) : false

    let commitTree: StoreTreeRuntime | undefined
    let completed = false
    // A plan already known to be empty at entry is not a commit at all, so it
    // opens nothing (a deferred flush alone does not count: an empty sink
    // notifies nobody). A plan whose emptiness only its own write phase can
    // decide must open first — the write phase runs inside the boundary — and
    // reports the answer to `end` below, which is what keeps a no-op reset or
    // an all-equal transaction from announcing a commit.
    if (
        boundary !== undefined &&
        (!workIsFinal || hasWork || plan.onSets.length > 0)
    ) {
        commitTree = boundary.begin(plan.data)
    }
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

        if (applied && globalForest) {
            try {
                const updates = globalForest.global.apply(
                    globalForest.global.sets,
                    plan.errors,
                )
                globalForest.globalUpdates =
                    updates.size > 0 ? updates : undefined
            } catch (error) {
                recordCommitError(plan.errors, error)
            }
        }

        if (applied) runOnSets(plan.onSets, plan.errors)

        if (applied && !workIsFinal) hasWork = settlementHasWork(settlement)

        if (
            applied &&
            hasWork &&
            planShouldContinue(plan) &&
            plan.beforeSettle !== undefined
        ) {
            try {
                plan.beforeSettle(plan.report)
            } catch (error) {
                recordCommitError(plan.errors, error)
            }
        }

        if (applied && hasWork && planShouldContinue(plan)) {
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
                } else if (settlement.kind === "forest") {
                    settlement.settle(
                        settlement.entries,
                        settlement.globalUpdates,
                        settlement.global?.source,
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

        if (
            applied &&
            hasWork &&
            planShouldContinue(plan) &&
            plan.afterSettle
        ) {
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
        if (commitTree) {
            try {
                boundary!.end(
                    commitTree,
                    plan.errors.hasError || !completed,
                    // What the boundary could not know when it opened: a plan
                    // whose write phase produced no settlement work, ran no
                    // hook, and captured no error committed nothing, so it
                    // announces nothing. Work done by a NESTED commit inside it
                    // is recorded on the tree and still notifies.
                    hasWork ||
                        plan.onSets.length > 0 ||
                        plan.errors.hasError ||
                        !completed,
                )
            } catch (error) {
                recordCommitError(plan.errors, error)
            }
        }
    }

    if (plan.afterCommit) {
        try {
            plan.afterCommit()
        } catch (error) {
            recordCommitError(plan.errors, error)
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
