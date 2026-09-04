import {
    DEFAULT_PAIRED_POLICY,
    decidePairedRun,
    type PairedComparison,
    type PairedSample,
    type PairedDecision,
} from "./paired-decision"
export type TournamentStage = "C" | "A"
export type TournamentStatus = "pass" | "fail" | "inconclusive"
export interface TournamentLane {
    id: string
    runtime: string
    core: boolean
    intended: boolean
    samples: PairedSample[]
    unpairedBase?: number
    unpairedHead?: number
    tierUnsettled?: boolean
}
function requireCondition(ok: unknown, id: string, detail: string): asserts ok {
    if (!ok) throw Error(`${id}: ${detail}`)
}
export function ordinaryMedian(values: number[]): number {
    requireCondition(values.length, "STATS-SAMPLE", "empty arm")
    const ordered = [...values].sort((a, b) => a - b),
        middle = Math.floor(ordered.length / 2)
    return ordered.length % 2
        ? ordered[middle]!
        : (ordered[middle - 1]! + ordered[middle]!) / 2
}
export function nearestRank(values: number[], quantile: number): number {
    requireCondition(
        values.length && quantile > 0 && quantile <= 1,
        "STATS-SAMPLE",
        "invalid quantile",
    )
    return [...values].sort((a, b) => a - b)[
        Math.ceil(values.length * quantile) - 1
    ]!
}
export function tournamentPairs(stage: TournamentStage, core: boolean): number {
    requireCondition(stage === "C" || stage === "A", "STATS-STAGE", stage)
    return stage === "C" ? 8 : core ? 50 : 24
}
function status(decision: PairedDecision): TournamentStatus {
    return decision.outcome === "within-budget"
        ? "pass"
        : decision.outcome === "regression"
          ? "fail"
          : "inconclusive"
}
// Both named tests call the EXISTING estimator/SE/tail/BH implementation.
// Existing PR defaults remain unchanged. These calls deliberately have separate
// nulls and separate BH families; intended evidence cannot rescue protected rows.
export function decideTournament(
    lanes: TournamentLane[],
    stage: TournamentStage,
    { control = false }: { control?: boolean } = {},
) {
    requireCondition(lanes.length > 0, "STATS-INVENTORY", "no rows")
    const ids = new Set<string>()
    const comparisons: PairedComparison[] = lanes.map(lane => {
        const key = lane.id + "/" + lane.runtime
        requireCondition(!ids.has(key), "STATS-INVENTORY", "duplicate " + key)
        ids.add(key)
        requireCondition(
            typeof lane.intended === "boolean" &&
                typeof lane.core === "boolean",
            "STATS-INVENTORY",
            "missing family flags",
        )
        requireCondition(
            !(lane.unpairedBase ?? 0) && !(lane.unpairedHead ?? 0),
            "STATS-PAIRS",
            "unpaired observations",
        )
        requireCondition(
            lane.samples.length === tournamentPairs(stage, lane.core),
            "STATS-PAIRS",
            key,
        )
        const pairs = new Set<string>()
        for (const sample of lane.samples) {
            requireCondition(
                typeof sample.pairId === "string" &&
                    sample.pairId.length &&
                    !pairs.has(sample.pairId),
                "STATS-PAIRS",
                "missing or duplicate pair",
            )
            pairs.add(sample.pairId)
            requireCondition(
                Number.isFinite(sample.baseNs) &&
                    sample.baseNs > 0 &&
                    Number.isFinite(sample.headNs) &&
                    sample.headNs > 0,
                "STATS-SAMPLE",
                "invalid duration",
            )
            for (const batch of [sample.baseBatchSize, sample.headBatchSize])
                requireCondition(
                    batch === undefined ||
                        (Number.isFinite(batch) && batch > 0),
                    "STATS-SAMPLE",
                    "invalid batch",
                )
        }
        return {
            benchmark: lane.id,
            runtime: lane.runtime,
            suite: "selector-kernel-tournament",
            family: "protected",
            samples: lane.samples,
            unpairedBase: 0,
            unpairedHead: 0,
            tierUnsettled: lane.tierUnsettled,
        }
    })
    requireCondition(
        !control || lanes.every(l => !l.intended),
        "STATS-CONTROL",
        "control cannot declare intended wins",
    )
    const policy = {
        ...DEFAULT_PAIRED_POLICY,
        minPairs: stage === "C" ? 8 : 24,
        budgetPct: 0.1,
    }
    const protectedDecisions = decidePairedRun(comparisons, policy)
    const intendedIndices = lanes.flatMap((lane, index) =>
        lane.intended ? [index] : [],
    )
    const wins = decidePairedRun(
        intendedIndices.map(index => comparisons[index]!),
        { ...policy, budgetPct: 0 },
    )
    const intendedDecisions = new Map(
        intendedIndices.map((index, i) => [index, wins[i]!]),
    )
    const rows = lanes.map((lane, index) => {
        const protection = protectedDecisions[index]!,
            win = intendedDecisions.get(index)
        const baseline = lane.samples.map(s => s.baseNs),
            candidate = lane.samples.map(s => s.headNs)
        const estimateRatio = Math.exp(protection.estimateLn),
            interval90 = protection.intervalPct!.map(p => 1 + p) as [
                number,
                number,
            ]
        const baselineP95 = nearestRank(baseline, 0.95),
            candidateP95 = nearestRank(candidate, 0.95),
            p95Ratio = candidateP95 / baselineP95
        const cSignal =
            estimateRatio <= 0.85 &&
            interval90[1] < 1 &&
            !protection.flags.includes("bimodal")
        const intendedPass = Boolean(
            win && status(win) === "pass" && estimateRatio <= 0.85,
        )
        const nonRegression: TournamentStatus =
            stage === "C"
                ? protection.flags.includes("bimodal")
                    ? "inconclusive"
                    : estimateRatio <= 1.2
                      ? "pass"
                      : "fail"
                : status(protection)
        const tail: TournamentStatus =
            stage === "C" || p95Ratio <= 1.2 ? "pass" : "fail"
        return {
            id: lane.id,
            runtime: lane.runtime,
            baselineId: "beta36-control" as const,
            protected: true,
            intended: lane.intended,
            status: tail === "fail" ? "fail" : nonRegression,
            pairs: lane.samples.length,
            baselineP50: ordinaryMedian(baseline),
            candidateP50: ordinaryMedian(candidate),
            baselineP95,
            candidateP95,
            p95Ratio,
            estimateRatio,
            interval90,
            decisions: {
                protectedNonRegression:
                    stage === "A"
                        ? {
                              nullRatio: 1.1,
                              alternative: "less",
                              pValue: protection.withinBudgetP,
                              qValue: protection.withinBudgetQ,
                              status: status(protection),
                          }
                        : null,
                intendedWin:
                    stage === "A" && win
                        ? {
                              nullRatio: 1,
                              alternative: "less",
                              pValue: win.withinBudgetP,
                              qValue: win.withinBudgetQ,
                              status: intendedPass
                                  ? "pass"
                                  : status(win) === "fail"
                                    ? "fail"
                                    : "inconclusive",
                          }
                        : null,
                pre28Claim: null,
            },
            flags: protection.flags,
            raw: {
                ratios: lane.samples.map(s => s.headNs / s.baseNs),
                logRatios: protection.logRatios,
                standardErrorLn: protection.standardErrorLn,
                degreesOfFreedom: protection.degreesOfFreedom,
                regressionP: protection.regressionP,
                regressionQ: protection.regressionQ,
            },
            cIntendedSignal: lane.intended && cSignal,
            nonRegression,
            tail,
            intendedPass,
        }
    })
    const safe = rows.every(
        row => row.nonRegression === "pass" && row.tail === "pass",
    )
    const hasWin = rows.some(row =>
        stage === "C" ? row.cIntendedSignal : row.intendedPass,
    )
    const failure = rows.some(
        row => row.nonRegression === "fail" || row.tail === "fail",
    )
    return {
        stage,
        control,
        rows,
        performanceStatus: failure
            ? "fail"
            : safe && (control || hasWin)
              ? "pass"
              : "inconclusive",
        tailStatus: rows.every(row => row.tail === "pass") ? "pass" : "fail",
        intendedWinRequired: !control,
        intendedWinEstablished: control ? null : hasWin,
    }
}
