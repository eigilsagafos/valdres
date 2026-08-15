import { describe, expect, test } from "bun:test"
import {
    buildComparisons,
    pairedGateFailure,
    renderReport,
    validateBlockingEvidence,
} from "./bench-paired-report"
import { PROTECTED_OPS } from "./lib/bench-protected-set"
import { decidePairedRun } from "./lib/paired-decision"
import type { BenchmarkObservation } from "./lib/read-bench-results"

function observation(
    benchmark: string,
    p50: number,
    overrides: Partial<BenchmarkObservation> = {},
): BenchmarkObservation {
    const side = overrides.side ?? "base"
    return {
        schemaVersion: 2,
        kind: "latency",
        unit: "ns",
        benchmark,
        pairId: "p1",
        side,
        order: side === "base" ? 1 : 2,
        runtime: "bun",
        suite: "standard",
        runId: `${side}-${overrides.pairId ?? "p1"}`,
        processId: 1,
        p25: p50 * 0.8,
        p50,
        p75: p50 * 1.2,
        p99: p50 * 1.5,
        ticks: 1000,
        sampleCount: 100,
        ...overrides,
    }
}

function paired(
    benchmark: string,
    values: Array<[number, number]>,
    overrides: Partial<BenchmarkObservation> = {},
) {
    const base: BenchmarkObservation[] = []
    const head: BenchmarkObservation[] = []
    values.forEach(([baseNs, headNs], index) => {
        const pairId = `p${index}`
        base.push(
            observation(benchmark, baseNs, {
                ...overrides,
                pairId,
                side: "base",
            }),
        )
        head.push(
            observation(benchmark, headNs, {
                ...overrides,
                pairId,
                side: "head",
            }),
        )
    })
    return { base, head }
}

describe("buildComparisons", () => {
    test("pairs by explicit identity, not by file position", () => {
        const { base, head } = paired("get 1000 atoms / valdres", [
            [10_000, 10_100],
            [10_000, 10_050],
            [10_000, 9_950],
            [10_000, 10_020],
        ])
        const [comparison] = buildComparisons(base, [...head].reverse())
        expect(comparison.samples).toHaveLength(4)
        expect(comparison.family).toBe("protected")
        for (const sample of comparison.samples) {
            expect(sample.baseNs).toBe(10_000)
        }
    })

    test("records a missing side instead of throwing", () => {
        const { base, head } = paired("get 1000 atoms / valdres", [
            [10_000, 10_100],
            [10_000, 10_050],
            [10_000, 9_950],
        ])
        const [comparison] = buildComparisons(base, head.slice(0, 2))
        expect(comparison.samples).toHaveLength(2)
        expect(comparison.unpairedBase).toBe(1)
        expect(comparison.unpairedHead).toBe(0)
    })

    test("demotes a sub-microsecond benchmark to informational", () => {
        const { base, head } = paired("set(atom, value) / valdres", [
            [131, 351],
            [131, 351],
            [131, 131],
        ])
        const [comparison] = buildComparisons(base, head)
        expect(comparison.family).toBe("informational")
        expect(comparison.subMicrosecond).toBe(true)
    })

    test("renders a comparison that lost every pair without NaN", () => {
        const { base } = paired("get 1000 atoms / valdres", [
            [10_000, 10_000],
            [10_000, 10_000],
        ])
        const decisions = decidePairedRun(buildComparisons(base, []))
        expect(decisions[0].pairs).toBe(0)
        const markdown = renderReport(decisions, {
            round: 1,
            maxRounds: 3,
            rerunLanes: [],
        })
        expect(markdown).not.toContain("NaN")
    })

    test("keeps runtimes and suites as separate comparisons", () => {
        const bun = paired("get 1000 atoms / valdres", [[10_000, 10_000]])
        const node = paired("get 1000 atoms / valdres", [[20_000, 20_000]], {
            runtime: "node",
        })
        const comparisons = buildComparisons(
            [...bun.base, ...node.base],
            [...bun.head, ...node.head],
        )
        expect(comparisons).toHaveLength(2)
        expect(comparisons.map(c => c.runtime).sort()).toEqual(["bun", "node"])
    })

    test("carries Mitata's batch size through for the regime diagnostic", () => {
        const { base, head } = paired("get 1000 atoms / valdres", [
            [10_000, 10_000],
        ])
        const [comparison] = buildComparisons(base, head)
        expect(comparison.samples[0].baseBatchSize).toBe(10)
        expect(comparison.samples[0].headBatchSize).toBe(10)
    })

    test("the historical stall vector survives to the report as a flag", () => {
        const { base, head } = paired("get 1000 atoms / valdres", [
            [131_000, 351_000],
            [131_000, 351_000],
            [131_000, 131_000],
        ])
        const [decision] = decidePairedRun(buildComparisons(base, head))
        expect(decision.flags).toContain("bimodal")
        expect(decision.outcome).toBe("inconclusive")
    })
})

describe("renderReport", () => {
    test("states that protected regressions block and names the backstop", () => {
        const { base, head } = paired("get 1000 atoms / valdres", [
            [10_000, 10_000],
            [10_000, 10_010],
            [10_000, 9_990],
            [10_000, 10_005],
        ])
        const markdown = renderReport(
            decidePairedRun(buildComparisons(base, head)),
            { round: 1, maxRounds: 3, rerunLanes: [] },
        )
        expect(markdown).toContain("block pull requests")
        expect(markdown).toContain("min(head/base)")
        expect(markdown).toContain("get 1000 atoms / valdres")
        expect(markdown).toContain("within-budget")
    })

    test("names the lanes it is asking to rerun", () => {
        const { base, head } = paired("get 1000 atoms / valdres", [
            [10_000, 10_000],
        ])
        const markdown = renderReport(
            decidePairedRun(buildComparisons(base, head)),
            { round: 2, maxRounds: 3, rerunLanes: ["bun:standard"] },
        )
        expect(markdown).toContain("bun:standard")
        expect(markdown).toContain("round **2/3**")
    })
})

function completeProtectedRun(
    outcome: "within-budget" | "regression" | "inconclusive" = "within-budget",
    pairs: number = 4,
) {
    return [...PROTECTED_OPS].flatMap(benchmark =>
        (["bun", "node"] as const).map(runtime => ({
            benchmark: `${benchmark} / valdres`,
            runtime,
            suite: "standard",
            family: "protected" as const,
            outcome,
            flags: [],
            pairs,
            unpairedBase: 0,
            unpairedHead: 0,
            estimateLn: 0,
            estimatePct: outcome === "regression" ? 0.2 : 0,
            standardErrorLn: 0.005,
            degreesOfFreedom: pairs - 1,
            intervalPct: [0, 0] as [number, number],
            regressionP: outcome === "regression" ? 0.001 : 1,
            withinBudgetP: outcome === "within-budget" ? 0.001 : 1,
            regressionQ: outcome === "regression" ? 0.001 : 1,
            withinBudgetQ: outcome === "within-budget" ? 0.001 : 1,
            logRatios: Array.from({ length: pairs }, () => 0),
        })),
    )
}

describe("pairedGateFailure", () => {
    test("passes a complete within-budget run", () => {
        expect(pairedGateFailure(completeProtectedRun())).toBeNull()
    })

    test("blocks a protected regression", () => {
        expect(pairedGateFailure(completeProtectedRun("regression"))).toContain(
            "protected performance regressions",
        )
    })

    test("requires inconclusive rows to reach the bounded cap", () => {
        expect(
            pairedGateFailure(completeProtectedRun("inconclusive", 4), 12),
        ).toContain("stopped before the 12-pair cap")
        expect(
            pairedGateFailure(completeProtectedRun("inconclusive", 12), 12),
        ).toBeNull()
    })

    test("fails closed on missing or unpaired protected evidence", () => {
        expect(pairedGateFailure(completeProtectedRun().slice(1))).toContain(
            "missing protected observations",
        )
        const unpaired = completeProtectedRun()
        unpaired[0].unpairedBase = 1
        expect(pairedGateFailure(unpaired)).toContain(
            "unpaired protected observations",
        )
    })
})

describe("validateBlockingEvidence", () => {
    test("rejects malformed identity metadata before a blocking decision", () => {
        const { base, head } = paired("get 1000 atoms / valdres", [
            [10_000, 10_100],
            [10_000, 10_050],
            [10_000, 9_950],
            [10_000, 10_020],
        ])

        expect(() =>
            validateBlockingEvidence([...base, base[0]], head),
        ).toThrow("Duplicate base observation")
        expect(() =>
            validateBlockingEvidence(base, [
                { ...head[0], order: base[0].order },
                ...head.slice(1),
            ]),
        ).toThrow("Invalid execution order metadata")
        expect(() =>
            validateBlockingEvidence(base, [
                { ...head[0], runId: base[0].runId },
                ...head.slice(1),
            ]),
        ).toThrow("Duplicate run identity")
        expect(() => validateBlockingEvidence(base, head.slice(1))).toThrow(
            "Mismatched pair IDs",
        )
    })
})
