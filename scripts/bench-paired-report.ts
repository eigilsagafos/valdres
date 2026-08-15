/**
 * Paired benchmark analysis and blocking PR-gate decision.
 *
 * Reads the base and head observation NDJSON for both runtimes, pairs them by
 * explicit pair identity, runs the decision model in scripts/lib/paired-decision.ts,
 * and writes a markdown report plus a machine-readable JSON artifact. The
 * weekly/manual deep workflow uses it for calibration evidence; the privileged
 * PR gate sets BENCH_ENFORCE=1 so a protected regression exits non-zero. The
 * three-pair `min(head/base)` +50% Bencher gate remains as a redundant
 * catastrophic backstop.
 *
 * Its one side effect on CI control flow is the rerun-lanes file, which asks the
 * workflow to append more pairs to lanes whose PROTECTED benchmarks came back
 * inconclusive — bounded by BENCH_MAX_ROUNDS. It writes files only; the
 * workflow decides what reaches the job summary.
 *
 *   BENCH_PAIRED_BASE_BUN / _NODE   base observations (required, per runtime)
 *   BENCH_PAIRED_HEAD_BUN / _NODE   head observations (required, per runtime)
 *   BENCH_REPORT_JSON               JSON artifact path
 *   BENCH_REPORT_MD                 markdown path the publish step appends
 *   BENCH_ROUND / BENCH_MAX_ROUNDS  position in the rerun ladder
 */
import { writeFileSync } from "fs"
import { validatePairedObservations } from "./bench-to-bmf"
import {
    PROTECTED_OPS,
    isProtected,
    isSubMicrosecond,
    TIMING_FLOOR_NS,
} from "./lib/bench-protected-set"
import { isReference, opName } from "./lib/benchmark-names"
import { median } from "./lib/median"
import {
    DEFAULT_PAIRED_POLICY,
    decidePairedRun,
    lanesNeedingRerun,
    type PairedComparison,
    type PairedDecision,
    type PairedSample,
} from "./lib/paired-decision"
import {
    BENCHMARK_RESULT_SCHEMA_VERSION,
    readBenchResults,
    type BenchmarkObservation,
    type BenchResult,
} from "./lib/read-bench-results"

function requireObservations(
    results: BenchResult[],
    source: string,
): BenchmarkObservation[] {
    if (
        results.some(
            result =>
                !("schemaVersion" in result) ||
                result.schemaVersion !== BENCHMARK_RESULT_SCHEMA_VERSION,
        )
    ) {
        throw new Error(
            `${source}: paired analysis requires schemaVersion ${BENCHMARK_RESULT_SCHEMA_VERSION} observations`,
        )
    }
    return results as BenchmarkObservation[]
}

function batchSize(observation: BenchmarkObservation): number {
    return observation.ticks / observation.sampleCount
}

/** Fail closed on the complete process/pair protocol for blocking evidence. */
export function validateBlockingEvidence(
    baseObservations: BenchmarkObservation[],
    headObservations: BenchmarkObservation[],
): void {
    validatePairedObservations([baseObservations, headObservations])
}

/**
 * Group observations into per-benchmark comparisons. Unlike the strict gate
 * converter this tolerates a missing side: a dropped pair is recorded and the
 * remaining pairs are analysed, because losing one process block should widen
 * the interval rather than fail the whole report.
 */
export function buildComparisons(
    baseObservations: BenchmarkObservation[],
    headObservations: BenchmarkObservation[],
): PairedComparison[] {
    type Slot = { base?: BenchmarkObservation; head?: BenchmarkObservation }
    const groups = new Map<
        string,
        {
            benchmark: string
            runtime: string
            suite: string
            pairs: Map<string, Slot>
        }
    >()

    for (const observation of [...baseObservations, ...headObservations]) {
        const key = [
            observation.benchmark,
            observation.runtime,
            observation.suite,
        ].join("\u0000")
        let group = groups.get(key)
        if (!group) {
            group = {
                benchmark: observation.benchmark,
                runtime: observation.runtime,
                suite: observation.suite,
                pairs: new Map(),
            }
            groups.set(key, group)
        }
        const slot = group.pairs.get(observation.pairId) ?? {}
        if (slot[observation.side] !== undefined) {
            console.warn(
                `Duplicate ${observation.side} observation for ${observation.benchmark} in pair ${observation.pairId} — keeping the first`,
            )
        } else {
            slot[observation.side] = observation
        }
        group.pairs.set(observation.pairId, slot)
    }

    const comparisons: PairedComparison[] = []
    for (const group of groups.values()) {
        const samples: PairedSample[] = []
        let unpairedBase = 0
        let unpairedHead = 0
        for (const [pairId, slot] of group.pairs) {
            if (slot.base && slot.head) {
                samples.push({
                    pairId,
                    baseNs: slot.base.p50,
                    headNs: slot.head.p50,
                    baseBatchSize: batchSize(slot.base),
                    headBatchSize: batchSize(slot.head),
                })
            } else if (slot.base) unpairedBase++
            else unpairedHead++
        }
        if (samples.length === 0 && unpairedBase + unpairedHead === 0) continue

        const baseCenter =
            samples.length > 0
                ? median(samples.map(sample => sample.baseNs))
                : Number.POSITIVE_INFINITY
        comparisons.push({
            benchmark: group.benchmark,
            runtime: group.runtime,
            suite: group.suite,
            family: isProtected(group.benchmark, baseCenter)
                ? "protected"
                : "informational",
            samples,
            unpairedBase,
            unpairedHead,
            subMicrosecond: isSubMicrosecond(baseCenter),
        })
    }

    return comparisons.sort(
        (a, b) =>
            a.benchmark.localeCompare(b.benchmark) ||
            a.runtime.localeCompare(b.runtime),
    )
}

const OUTCOME_MARK = {
    regression: "🔴",
    "within-budget": "🟢",
    inconclusive: "⚪",
} as const

function pct(value: number): string {
    // A comparison can lose every pair — one side crashed, or the benchmark is
    // new on head — and then there is no estimate to render.
    if (!Number.isFinite(value)) return "—"
    return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`
}

function row(decision: PairedDecision): string {
    const interval = decision.intervalPct
        ? `${pct(decision.intervalPct[0])} … ${pct(decision.intervalPct[1])}`
        : "—"
    const q =
        decision.outcome === "regression"
            ? decision.regressionQ
            : decision.withinBudgetQ
    const flags = decision.flags.length > 0 ? decision.flags.join(", ") : ""
    return `| ${OUTCOME_MARK[decision.outcome]} ${decision.outcome} | \`${decision.benchmark}\` | ${decision.runtime} | ${decision.pairs} | ${pct(decision.estimatePct)} | ${interval} | ${Number.isFinite(q) ? q.toExponential(1) : "—"} | ${flags} |`
}

const TABLE_HEAD = [
    "| outcome | benchmark | runtime | pairs | estimate | 90% interval | q | flags |",
    "|:--|:--|:--|--:|--:|:--|--:|:--|",
].join("\n")

export function renderReport(
    decisions: PairedDecision[],
    context: { round: number; maxRounds: number; rerunLanes: string[] },
): string {
    const protectedRows = decisions.filter(d => d.family === "protected")
    const informational = decisions.filter(d => d.family === "informational")
    const tally = (rows: PairedDecision[]) => {
        const counts = { regression: 0, "within-budget": 0, inconclusive: 0 }
        for (const decision of rows) counts[decision.outcome]++
        return counts
    }
    const counts = tally(protectedRows)
    const budget = `${(DEFAULT_PAIRED_POLICY.budgetPct * 100).toFixed(0)}%`

    const lines = [
        "## Paired benchmark decision model",
        "",
        `Budget **+${budget}**, FDR **${DEFAULT_PAIRED_POLICY.falseDiscoveryRate}**, estimator **${DEFAULT_PAIRED_POLICY.estimator}**, round **${context.round}/${context.maxRounds}**.`,
        "",
        `Protected: ${counts.regression} regression, ${counts["within-budget"]} within budget, ${counts.inconclusive} inconclusive.`,
        "",
        "Protected `regression` verdicts block pull requests. `inconclusive`",
        "rows run the bounded ladder and remain non-blocking at its cap. The",
        "`min(head/base)` +50% gate remains as a catastrophic backstop. See",
        "`scripts/PAIRED_DECISION_MODEL.md`.",
        "",
        "### Protected",
        "",
        TABLE_HEAD,
        ...protectedRows.map(row),
    ]

    const stalled = decisions.filter(
        decision =>
            decision.family === "protected" &&
            decision.outcome === "inconclusive",
    )
    if (context.rerunLanes.length > 0) {
        lines.push(
            "",
            `Requesting more pairs for: ${context.rerunLanes.map(lane => `\`${lane}\``).join(", ")}.`,
        )
    } else if (stalled.length > 0) {
        lines.push(
            "",
            `Still inconclusive at the round cap: ${stalled.map(d => `\`${d.benchmark}\` (${d.runtime})`).join(", ")}.`,
        )
    }

    const notable = informational.filter(
        decision =>
            decision.outcome === "regression" ||
            decision.flags.includes("bimodal"),
    )
    lines.push(
        "",
        "### Informational",
        "",
        `${informational.length} comparisons, not decision-bearing (below the ${TIMING_FLOOR_NS}ns timing floor, a reference implementation, or outside the protected set).`,
        "",
    )
    if (notable.length > 0) {
        lines.push(
            "Flagged for attention:",
            "",
            TABLE_HEAD,
            ...notable.map(row),
        )
    } else {
        lines.push("Nothing flagged.")
    }

    return lines.join("\n") + "\n"
}

export function pairedGateFailure(
    decisions: PairedDecision[],
    maxPairs: number = DEFAULT_PAIRED_POLICY.minPairs * 3,
): string | null {
    const observed = new Set(
        decisions
            .filter(decision => !isReference(decision.benchmark))
            .map(
                decision =>
                    `${opName(decision.benchmark)}\u0000${decision.runtime}`,
            ),
    )
    const missing: string[] = []
    for (const benchmark of PROTECTED_OPS) {
        for (const runtime of ["bun", "node"]) {
            if (!observed.has(`${benchmark}\u0000${runtime}`)) {
                missing.push(`${benchmark} (${runtime})`)
            }
        }
    }
    if (missing.length > 0) {
        return `missing protected observations: ${missing.join(", ")}`
    }

    const protectedDecisions = decisions.filter(
        decision => decision.family === "protected",
    )
    const unpaired = protectedDecisions.filter(
        decision => decision.unpairedBase > 0 || decision.unpairedHead > 0,
    )
    if (unpaired.length > 0) {
        return `unpaired protected observations: ${unpaired.map(decision => `${decision.benchmark} (${decision.runtime})`).join(", ")}`
    }

    const premature = protectedDecisions.filter(
        decision =>
            decision.outcome === "inconclusive" && decision.pairs < maxPairs,
    )
    if (premature.length > 0) {
        return `protected comparisons stopped before the ${maxPairs}-pair cap: ${premature.map(decision => `${decision.benchmark} (${decision.runtime}, ${decision.pairs} pairs)`).join(", ")}`
    }

    const regressions = protectedDecisions.filter(
        decision => decision.outcome === "regression",
    )
    if (regressions.length > 0) {
        return `protected performance regressions: ${regressions.map(decision => `${decision.benchmark} (${decision.runtime}, ${pct(decision.estimatePct)})`).join(", ")}`
    }
    return null
}

function positiveIntEnv(name: string, fallback: number): number {
    const raw = process.env[name]
    if (raw === undefined || raw === "") return fallback
    const value = Number(raw)
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer, received ${raw}`)
    }
    return value
}

if (import.meta.main) {
    const lanes = [
        {
            base: process.env.BENCH_PAIRED_BASE_BUN,
            head: process.env.BENCH_PAIRED_HEAD_BUN,
        },
        {
            base: process.env.BENCH_PAIRED_BASE_NODE,
            head: process.env.BENCH_PAIRED_HEAD_NODE,
        },
    ]

    const baseObservations: BenchmarkObservation[] = []
    const headObservations: BenchmarkObservation[] = []
    for (const lane of lanes) {
        if (!lane.base || !lane.head) continue
        baseObservations.push(
            ...requireObservations(readBenchResults(lane.base), lane.base),
        )
        headObservations.push(
            ...requireObservations(readBenchResults(lane.head), lane.head),
        )
    }

    const enforce = process.env.BENCH_ENFORCE === "1"
    if (enforce) {
        validateBlockingEvidence(baseObservations, headObservations)
    }

    const round = positiveIntEnv("BENCH_ROUND", 1)
    const maxRounds = positiveIntEnv("BENCH_MAX_ROUNDS", 3)
    const decisions = decidePairedRun(
        buildComparisons(baseObservations, headObservations),
    )
    // The ladder stops at the cap even with work outstanding; an unbounded
    // rerun loop is a worse failure than an inconclusive report.
    const rerunLanes = round < maxRounds ? lanesNeedingRerun(decisions) : []
    const markdown = renderReport(decisions, { round, maxRounds, rerunLanes })

    const jsonPath = process.env.BENCH_REPORT_JSON
    if (jsonPath) {
        writeFileSync(
            jsonPath,
            JSON.stringify(
                { round, maxRounds, policy: DEFAULT_PAIRED_POLICY, decisions },
                null,
                2,
            ),
        )
    }
    const mdPath = process.env.BENCH_REPORT_MD
    if (mdPath) writeFileSync(mdPath, markdown)
    // The ladder driver in bencher-deep.yml reads this between rounds. Always
    // written, so a stale file from the previous round can never be re-read.
    const lanesPath = process.env.BENCH_RERUN_LANES_FILE
    if (lanesPath) writeFileSync(lanesPath, rerunLanes.join(" "))
    // Deliberately NOT appended to GITHUB_STEP_SUMMARY here. The deep workflow
    // publishes only its final round's markdown.
    console.log(markdown)

    if (enforce) {
        const failure = pairedGateFailure(
            decisions,
            DEFAULT_PAIRED_POLICY.minPairs * maxRounds,
        )
        if (failure) {
            console.error(`Paired benchmark gate failed: ${failure}`)
            process.exitCode = 1
        }
    }
}
