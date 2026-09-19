import { expect, test } from "bun:test"
import {
    collectExternalIsolation,
    reportExternalIsolation,
} from "./check-external-isolation"

function lane(workload: string, ratios: number[], baseline = 10_000) {
    return {
        engine: "bun",
        version: "fixture",
        workload,
        measurements: ratios.map((ratio, index) => ({
            baseline,
            installed: baseline * ratio,
            ratio: (baseline * ratio) / baseline,
            order:
                index % 2
                    ? (["installed", "baseline"] as const)
                    : (["baseline", "installed"] as const),
        })),
    }
}

test("reports all three timing outcomes and blocks only credible regression", () => {
    const report = reportExternalIsolation([
        lane("reads", Array(8).fill(1)),
        lane("subscriptions", Array(8).fill(1.1)),
        lane("writes", Array(8).fill(1.3)),
    ])
    expect(report.lanes.map(item => item.decision.outcome)).toEqual([
        "within-budget",
        "inconclusive",
        "regression",
    ])
    expect(report.summary.counts).toEqual({
        regression: 1,
        "within-budget": 1,
        inconclusive: 1,
    })
    expect(report.summary.timingBlocks).toBe(true)
    expect(report.summary.policy.budgetPct).toBe(0.1)
})

test("non-blocking uncertainty is explicitly inconclusive, never within-budget", () => {
    const report = reportExternalIsolation([
        lane("reads", [0.95, 1, 1.05, 1.08, 1.12, 1.15, 1.2, 1.25]),
    ])
    expect(report.lanes.map(item => item.decision.outcome)).toEqual([
        "inconclusive",
    ])
    expect(report.summary.counts).toEqual({
        regression: 0,
        "within-budget": 0,
        inconclusive: 1,
    })
    expect(report.summary.timingBlocks).toBe(false)
    expect(report.summary.inconclusivePolicy).toContain(
        "inconclusive does not establish slowdown <=10%",
    )
    expect(report.summary.primaryBlockingCertificate).toContain(
        "external-isolation.test.ts: zero planes and zero operations",
    )
})

test("within-budget timings are distinct from a non-blocking inconclusive run", () => {
    const report = reportExternalIsolation([
        lane("transactions", Array(8).fill(1.02)),
    ])
    expect(report.summary.counts).toEqual({
        regression: 0,
        "within-budget": 1,
        inconclusive: 0,
    })
    expect(report.summary.timingBlocks).toBe(false)
})

test("rejects the former nine-pair protocol instead of certifying unbalanced order", () => {
    expect(() =>
        reportExternalIsolation([lane("writes", Array(9).fill(1))]),
    ).toThrow("eight balanced pairs")
})

test.each([
    [1.3, 1.3, 1.3, 1.3, 2, 2, 2, 2],
    [1, 1, 1, 1, 1.5, 1.5, 1.5, 1.5],
    [0.7, 0.7, 0.7, 0.7, 1, 1, 1, 1],
])(
    "unresolved protected bimodality blocks without inventing a regression verdict: %j",
    (...ratios) => {
        const report = reportExternalIsolation([lane("writes", ratios)])
        expect(report.lanes[0]!.decision.outcome).toBe("inconclusive")
        expect(report.lanes[0]!.decision.flags).toContain("bimodal")
        expect(report.summary.timingBlocks).toBe(true)
        expect(report.lanes[0]!.blockingReason).toBe(
            "unresolved protected bimodality",
        )
    },
)

test("sub-1000ns baseline lanes are informational even if every pair regresses", () => {
    const report = reportExternalIsolation([
        lane("reads", Array(8).fill(2), 999),
    ])
    expect(report.lanes[0]!.decision.family).toBe("informational")
    expect(report.lanes[0]!.decision.flags).toContain("sub-microsecond")
    expect(report.lanes[0]!.decision.outcome).toBe("regression")
    expect(report.summary.timingBlocks).toBe(false)
})

test("collector executes four B-P-P-B blocks and pairs the actual observations", () => {
    const calls: string[] = []
    const measurements = collectExternalIsolation(arm => {
        calls.push(arm)
        return calls.length * 1_000
    })
    expect(calls).toEqual(
        Array(4)
            .fill(["baseline", "installed", "installed", "baseline"])
            .flat(),
    )
    expect(measurements).toHaveLength(8)
    expect(measurements.map(item => item.baseline)).toEqual([
        1_000, 4_000, 5_000, 8_000, 9_000, 12_000, 13_000, 16_000,
    ])
    expect(measurements.map(item => item.installed)).toEqual([
        2_000, 3_000, 6_000, 7_000, 10_000, 11_000, 14_000, 15_000,
    ])
    expect(measurements.map(item => item.order[0])).toEqual([
        "baseline",
        "installed",
        "baseline",
        "installed",
        "baseline",
        "installed",
        "baseline",
        "installed",
    ])
    for (const item of measurements)
        expect(item.ratio).toBe(item.installed / item.baseline)
    const report = reportExternalIsolation([
        { ...lane("writes", []), measurements },
    ])
    expect(report.summary.pairs).toBe(8)
    expect(report.summary.order).toBe("B-P-P-B")
})

test("eight pairs still require recorded balanced order", () => {
    const input = lane("writes", Array(8).fill(1))
    input.measurements[1]!.order = ["baseline", "installed"]
    expect(() => reportExternalIsolation([input])).toThrow(
        "balanced B-P-P-B order",
    )
    Reflect.deleteProperty(input.measurements[1]!, "order")
    expect(() => reportExternalIsolation([input])).toThrow(
        "balanced B-P-P-B order",
    )
})

test("missing, nonfinite and inconsistent measurements cannot certify", () => {
    expect(() => reportExternalIsolation([])).toThrow(
        "No isolation measurements",
    )
    expect(() =>
        reportExternalIsolation([lane("writes", Array(7).fill(1))]),
    ).toThrow("eight balanced pairs")
    for (const invalid of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        const input = lane("writes", Array(8).fill(1))
        input.measurements[0]!.baseline = invalid
        expect(() => reportExternalIsolation([input])).toThrow(
            "Invalid isolation measurement",
        )
    }
    const input = lane("writes", Array(8).fill(1))
    input.measurements[0]!.ratio = 2
    expect(() => reportExternalIsolation([input])).toThrow(
        "Invalid isolation measurement",
    )
})

test("the shared timing floor uses baseline median, not candidate cost or an outlier", () => {
    const tiny = lane("reads", Array(8).fill(2), 999)
    tiny.measurements[0]!.baseline = 100_000
    tiny.measurements[0]!.installed = 200_000
    const protectedLane = lane("writes", Array(8).fill(1.3), 1_000)
    protectedLane.measurements[0]!.baseline = 10
    protectedLane.measurements[0]!.installed = 13
    const report = reportExternalIsolation([tiny, protectedLane])
    expect(report.lanes.map(item => item.decision.family)).toEqual([
        "informational",
        "protected",
    ])
    expect(report.lanes[0]!.blockingReason).toBeNull()
    expect(report.lanes[1]!.blockingReason).toBe("protected regression")
    expect(report.summary.timingFloorNs).toBe(1_000)
    expect(report.summary.countsByFamily).toEqual({
        protected: { regression: 1, "within-budget": 0, inconclusive: 0 },
        informational: { regression: 1, "within-budget": 0, inconclusive: 0 },
    })
    expect(report.summary.timingBlocks).toBe(true)
})

test("informational bimodality is reported separately and cannot block the protected family", () => {
    const report = reportExternalIsolation([
        lane("reads", [1.3, 1.3, 1.3, 1.3, 2, 2, 2, 2], 100),
        lane("writes", Array(8).fill(1)),
    ])
    expect(report.lanes[0]!.decision.family).toBe("informational")
    expect(report.lanes[0]!.decision.flags).toContain("bimodal")
    expect(report.lanes[0]!.decision.outcome).toBe("inconclusive")
    expect(report.lanes[0]!.blockingReason).toBeNull()
    expect(report.summary.countsByFamily).toEqual({
        protected: { regression: 0, "within-budget": 1, inconclusive: 0 },
        informational: { regression: 0, "within-budget": 0, inconclusive: 1 },
    })
    expect(report.summary.timingBlocks).toBe(false)
})
