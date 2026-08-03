/**
 * The paired benchmark decision model.
 *
 * The shipped PR gate reduces each benchmark to `min(head/base)` over three
 * pairs and alerts above +50%. `min` is a deliberate one-sided filter for
 * runner interference, but it has no notion of confidence: it silently converts
 * a base 131/131/131 vs head 351/351/131 measurement — two of three pairs 2.7x
 * slow — into "0% change", because one clean pair is enough to clear it. That
 * gate is retained as the catastrophic backstop; this model is what replaces it
 * once calibrated.
 *
 * The model works on paired log-ratios r_i = ln(head_i) - ln(base_i):
 *
 *   1. Logs make the statistic symmetric (a 2x regression and a 2x improvement
 *      are +/- ln 2) and turn the multiplicative runner-wide slowdown that
 *      motivated relative CB into an additive term that pairing cancels.
 *   2. Location is a robust estimator (default Hodges-Lehmann) so a single
 *      stalled pair cannot carry the verdict.
 *   3. Dispersion is the Winsorized (Yuen) standard error with a resolution
 *      floor, giving an exact Student-t tail rather than a resampled interval —
 *      the whole report is reproducible from the uploaded NDJSON.
 *   4. Every comparison is tested against a single relative budget in BOTH
 *      directions, yielding three outcomes: `regression` (the effect is above
 *      budget), `within-budget` (the effect is demonstrably below it), and
 *      `inconclusive` (the data cannot separate the two). "No alert" and
 *      "demonstrated fine" stop being the same answer.
 *   5. p-values are FDR-adjusted within their family, so the answer does not
 *      degrade as benchmarks and runtimes are added.
 *
 * `inconclusive` is a first-class result, not a failure: it is what drives the
 * bounded rerun ladder for protected benchmarks.
 */
import {
    HODGES_LEHMANN_SE_INFLATION,
    LOCATION_ESTIMATORS,
    benjaminiHochberg,
    studentTQuantile,
    studentTUpperTail,
    trimCount,
    trimmedDegreesOfFreedom,
    winsorizedStandardError,
    type LocationEstimatorName,
} from "./robust-estimators"

export type PairedOutcome = "regression" | "within-budget" | "inconclusive"

/**
 * `protected` comparisons carry decisions and drive the rerun ladder;
 * `informational` ones are reported but never blocking. The families are also
 * the multiple-comparison families, which is why the protected set is kept
 * small: FDR adjustment across ~20 protected comparisons leaves usable power at
 * four to twelve pairs, while adjustment across all ~120 would not.
 */
export type DecisionFamily = "protected" | "informational"

export type DecisionFlag =
    | "bimodal"
    | "insufficient-pairs"
    | "unpaired-observations"
    | "batch-size-shift"
    | "sub-microsecond"

export interface PairedSample {
    pairId: string
    baseNs: number
    headNs: number
    /** ticks / sampleCount — Mitata's chosen batch size, when known. */
    baseBatchSize?: number
    headBatchSize?: number
}

export interface PairedComparison {
    benchmark: string
    runtime: string
    suite: string
    family: DecisionFamily
    samples: PairedSample[]
    /** Observations that never found a partner, by side. */
    unpairedBase: number
    unpairedHead: number
    /** Set when the comparison was demoted for being below the timing floor. */
    subMicrosecond?: boolean
}

export interface PairedPolicy {
    /** Relative slowdown the project is willing to absorb, e.g. 0.1 = +10%. */
    budgetPct: number
    /** Benjamini-Hochberg level, applied per family per direction. */
    falseDiscoveryRate: number
    /** Below this many usable pairs nothing is decided. */
    minPairs: number
    /** Symmetric trim fraction for the Winsorized standard error. */
    trimFraction: number
    /**
     * Floor on the standard error, as a log-ratio. Four pairs that happen to
     * agree to the last nanosecond do not mean the measurement is exact — they
     * mean the timer, the JIT tier and the batch size all held still. This
     * encodes the residual measurement resolution so that identical samples
     * cannot manufacture unbounded confidence.
     */
    minStandardErrorLn: number
    /** A gap smaller than this is never evidence of two process states. */
    bimodalMinGapLn: number
    /** How far the largest gap must dominate the next largest. */
    bimodalGapDominance: number
    /** Floor for the "next largest gap" so a zero-gap run cannot divide by 0. */
    bimodalGapFloorLn: number
    /**
     * Minority-cluster SHARE that counts as a second process state.
     *
     * Deliberately a fraction and not an absolute count: two deviant pairs out
     * of three are two process states, while two out of twelve are two stalls
     * that the robust estimator already absorbs. An absolute threshold would
     * latch — a lane contaminated early could never be cleared by rerunning,
     * so the ladder would burn every round and still report nothing.
     */
    bimodalMinorityFraction: number
    /** |ln(headBatch/baseBatch)| above this is reported as a regime change. */
    batchShiftLn: number
    estimator: LocationEstimatorName
}

export const DEFAULT_PAIRED_POLICY: PairedPolicy = {
    budgetPct: 0.1,
    falseDiscoveryRate: 0.05,
    minPairs: 4,
    trimFraction: 0.2,
    minStandardErrorLn: Math.log(1.005),
    bimodalMinGapLn: Math.log(1.2),
    bimodalGapDominance: 3,
    bimodalGapFloorLn: Math.log(1.03),
    bimodalMinorityFraction: 1 / 3,
    batchShiftLn: Math.log(2),
    estimator: "hodges-lehmann",
}

export interface BimodalityDiagnostic {
    bimodal: boolean
    /** Largest gap between consecutive sorted log-ratios. */
    gapLn: number
    /** Size of the smaller of the two clusters the gap separates. */
    minorityCount: number
}

/**
 * Two process states show up as two tight clusters of log-ratios separated by
 * one dominant gap — the shape of the 131/131/131 vs 351/351/131 measurement.
 * No location estimator should be trusted to summarise that with a single
 * number, so it is flagged and the comparison is left inconclusive.
 */
export function detectBimodality(
    logRatios: number[],
    policy: PairedPolicy,
): BimodalityDiagnostic {
    if (logRatios.length < 2) {
        return { bimodal: false, gapLn: 0, minorityCount: 0 }
    }
    const sorted = [...logRatios].sort((a, b) => a - b)
    const gaps = sorted
        .slice(1)
        .map((value, index) => ({ gap: value - sorted[index], index }))
    const largest = gaps.reduce((best, gap) =>
        gap.gap > best.gap ? gap : best,
    )
    const runnerUp = gaps
        .filter(gap => gap !== largest)
        .reduce((best, gap) => Math.max(best, gap.gap), 0)

    const lowCount = largest.index + 1
    const minorityCount = Math.min(lowCount, sorted.length - lowCount)
    const minorityIsCluster =
        minorityCount / sorted.length >= policy.bimodalMinorityFraction

    const bimodal =
        largest.gap >= policy.bimodalMinGapLn &&
        largest.gap >=
            policy.bimodalGapDominance *
                Math.max(runnerUp, policy.bimodalGapFloorLn) &&
        minorityIsCluster

    return { bimodal, gapLn: largest.gap, minorityCount }
}

export interface PairedDecision {
    benchmark: string
    runtime: string
    suite: string
    family: DecisionFamily
    outcome: PairedOutcome
    flags: DecisionFlag[]
    pairs: number
    unpairedBase: number
    unpairedHead: number
    estimateLn: number
    /** exp(estimateLn) - 1, i.e. the relative change. */
    estimatePct: number
    standardErrorLn: number
    degreesOfFreedom: number
    /** Unadjusted two-sided 90% interval on the relative change, for reading. */
    intervalPct: [number, number] | null
    regressionP: number
    withinBudgetP: number
    regressionQ: number
    withinBudgetQ: number
    logRatios: number[]
}

interface Summary {
    comparison: PairedComparison
    flags: DecisionFlag[]
    logRatios: number[]
    estimateLn: number
    standardErrorLn: number
    degreesOfFreedom: number
    intervalPct: [number, number] | null
    regressionP: number
    withinBudgetP: number
    decidable: boolean
}

function summarize(
    comparison: PairedComparison,
    policy: PairedPolicy,
): Summary {
    const flags: DecisionFlag[] = []
    if (comparison.subMicrosecond) flags.push("sub-microsecond")
    if (comparison.unpairedBase > 0 || comparison.unpairedHead > 0) {
        flags.push("unpaired-observations")
    }

    const logRatios = comparison.samples.map(sample =>
        Math.log(sample.headNs / sample.baseNs),
    )
    const batchShifts = comparison.samples
        .filter(
            sample =>
                sample.baseBatchSize !== undefined &&
                sample.headBatchSize !== undefined,
        )
        .map(sample =>
            Math.abs(Math.log(sample.headBatchSize! / sample.baseBatchSize!)),
        )
    // Reported, never decisive. Mitata picks a batch size from the measured
    // duration, so a genuine regression can legitimately move it; suppressing a
    // finding on that basis would hide the very thing being looked for.
    if (batchShifts.some(shift => shift > policy.batchShiftLn)) {
        flags.push("batch-size-shift")
    }

    const n = logRatios.length
    const g = trimCount(n, policy.trimFraction)
    const degreesOfFreedom = trimmedDegreesOfFreedom(n, g)
    const bimodality = detectBimodality(logRatios, policy)
    if (bimodality.bimodal) flags.push("bimodal")

    const estimateLn =
        n > 0 ? LOCATION_ESTIMATORS[policy.estimator](logRatios) : Number.NaN

    if (n < policy.minPairs || degreesOfFreedom < 1) {
        if (n < policy.minPairs) flags.push("insufficient-pairs")
        return {
            comparison,
            flags,
            logRatios,
            estimateLn,
            standardErrorLn: Number.NaN,
            degreesOfFreedom,
            intervalPct: null,
            regressionP: 1,
            withinBudgetP: 1,
            decidable: false,
        }
    }

    const inflation =
        policy.estimator === "hodges-lehmann" ? HODGES_LEHMANN_SE_INFLATION : 1
    const standardErrorLn = Math.max(
        policy.minStandardErrorLn,
        winsorizedStandardError(logRatios, g) * inflation,
    )
    const budgetLn = Math.log(1 + policy.budgetPct)
    // Two one-sided tests against the same boundary. `regressionP` asks whether
    // the effect is above budget; `withinBudgetP` asks whether it is below.
    // They cannot both be small, so the three outcomes are mutually exclusive.
    const regressionP = studentTUpperTail(
        (estimateLn - budgetLn) / standardErrorLn,
        degreesOfFreedom,
    )
    const withinBudgetP = studentTUpperTail(
        (budgetLn - estimateLn) / standardErrorLn,
        degreesOfFreedom,
    )
    const halfWidth = studentTQuantile(0.05, degreesOfFreedom) * standardErrorLn

    return {
        comparison,
        flags,
        logRatios,
        estimateLn,
        standardErrorLn,
        degreesOfFreedom,
        intervalPct: [
            Math.expm1(estimateLn - halfWidth),
            Math.expm1(estimateLn + halfWidth),
        ],
        regressionP,
        withinBudgetP,
        // A bimodal comparison is measured, not summarised: the point estimate
        // and interval stay in the report so the shape is visible, but no
        // verdict is drawn from them.
        decidable: !bimodality.bimodal,
    }
}

/**
 * Decide a whole run. Multiple-comparison adjustment happens here rather than
 * per comparison, because it depends on the family every comparison is in —
 * benchmarks and runtimes together.
 */
export function decidePairedRun(
    comparisons: PairedComparison[],
    policy: PairedPolicy = DEFAULT_PAIRED_POLICY,
): PairedDecision[] {
    const summaries = comparisons.map(comparison =>
        summarize(comparison, policy),
    )

    const qValues = new Map<Summary, { regression: number; within: number }>()
    for (const family of ["protected", "informational"] as const) {
        const inFamily = summaries.filter(
            summary => summary.comparison.family === family,
        )
        const regressionQ = benjaminiHochberg(
            inFamily.map(summary => summary.regressionP),
        )
        const withinQ = benjaminiHochberg(
            inFamily.map(summary => summary.withinBudgetP),
        )
        inFamily.forEach((summary, index) =>
            qValues.set(summary, {
                regression: regressionQ[index],
                within: withinQ[index],
            }),
        )
    }

    return summaries.map(summary => {
        const q = qValues.get(summary)!
        let outcome: PairedOutcome = "inconclusive"
        if (summary.decidable) {
            if (q.regression <= policy.falseDiscoveryRate)
                outcome = "regression"
            else if (q.within <= policy.falseDiscoveryRate) {
                outcome = "within-budget"
            }
        }
        return {
            benchmark: summary.comparison.benchmark,
            runtime: summary.comparison.runtime,
            suite: summary.comparison.suite,
            family: summary.comparison.family,
            outcome,
            flags: summary.flags,
            pairs: summary.logRatios.length,
            unpairedBase: summary.comparison.unpairedBase,
            unpairedHead: summary.comparison.unpairedHead,
            estimateLn: summary.estimateLn,
            estimatePct: Math.expm1(summary.estimateLn),
            standardErrorLn: summary.standardErrorLn,
            degreesOfFreedom: summary.degreesOfFreedom,
            intervalPct: summary.intervalPct,
            regressionP: summary.regressionP,
            withinBudgetP: summary.withinBudgetP,
            regressionQ: q.regression,
            withinBudgetQ: q.within,
            logRatios: summary.logRatios,
        }
    })
}

/**
 * Lanes (runtime + suite) holding at least one undecided protected comparison.
 * Rerunning a lane appends pairs to every benchmark in it, which is the only
 * granularity the suites can actually be re-executed at.
 */
export function lanesNeedingRerun(decisions: PairedDecision[]): string[] {
    const lanes = new Set<string>()
    for (const decision of decisions) {
        if (decision.family !== "protected") continue
        if (decision.outcome === "inconclusive") {
            lanes.add(`${decision.runtime}:${decision.suite}`)
        }
    }
    return [...lanes].sort()
}
