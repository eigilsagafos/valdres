import type { State } from "../../types/State"

/**
 * What one selector evaluation discovered, handed from the evaluator to the
 * graph installer by the dispatcher that ran it. Evaluators fill every field
 * exactly once, immediately before returning — never during dependency
 * capture — and never touch graph tables themselves; whoever ran the
 * evaluator installs the outcome (or skips the call when `needsInstall` is
 * false) and releases the carrier.
 */
export type EvaluationOutcome = {
    /** Deduped deps read this evaluation. Escapes into stateDependencies on
     *  sync installs, so it is allocated per evaluation (status quo). */
    deps: Set<State> | undefined
    /** Dependency set observed at evaluation start (committed table or the
     *  transaction overlay map). Undefined = first materialization. */
    prevDeps: Set<State> | undefined
    depsChanged: boolean
    /** Result was promise-like or a suspension — install merges prevDeps
     *  forward instead of removing them (reconciled on resolve). */
    isAsync: boolean
    /** = depsChanged || !prevDeps. False on the no-churn steady state, which
     *  therefore makes zero graph-runtime calls. */
    needsInstall: boolean
}

export const createEvaluationOutcome = (): EvaluationOutcome => ({
    deps: undefined,
    prevDeps: undefined,
    depsChanged: false,
    isAsync: false,
    needsInstall: false,
})

/**
 * Depth-indexed carrier pool for the dispatcher paths, where evaluations
 * recurse (a selector body reading a fresh child selector re-enters the
 * dispatcher mid-capture): each frame takes its own slot, and allocation
 * happens only at the high-water depth mark. Callers MUST release in a
 * `finally` so a throwing evaluation or install unwinds the depth, and must
 * consume the outcome before running anything that could evaluate another
 * selector (release does both: it clears the dep references so the pool
 * retains no states, and pops the frame).
 *
 * The propagation loops instead own one plain carrier per PASS (like their
 * reusable DepsChange) via `createEvaluationOutcome` — no pool traffic on the
 * re-evaluation hot path.
 */
const pool: EvaluationOutcome[] = []
let depth = 0

export const acquireEvaluationOutcome = (): EvaluationOutcome => {
    let outcome = pool[depth]
    if (!outcome) {
        outcome = createEvaluationOutcome()
        pool[depth] = outcome
    }
    depth++
    // An evaluator that throws never writes the carrier; the dispatcher's
    // install gate must then read a definite false, not a stale true.
    outcome.needsInstall = false
    return outcome
}

export const releaseEvaluationOutcome = (outcome: EvaluationOutcome): void => {
    outcome.deps = undefined
    outcome.prevDeps = undefined
    depth--
}
