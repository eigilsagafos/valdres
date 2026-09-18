import { expect, test } from "bun:test"
import { reportExternalIsolation } from "./check-external-isolation"

function lane(workload: string, ratios: number[]) {
    return {
        engine: "bun",
        version: "fixture",
        workload,
        measurements: ratios.map(ratio => ({
            baseline: 100,
            installed: 100 * ratio,
            ratio,
        })),
    }
}

test("reports all three timing outcomes and blocks only credible regression", () => {
    const report = reportExternalIsolation([
        lane("reads", Array(9).fill(1)),
        lane("subscriptions", Array(9).fill(1.1)),
        lane("writes", Array(9).fill(1.3)),
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
        lane("reads", [0.95, 1, 1.05, 1.08, 1.1, 1.12, 1.15, 1.2, 1.25]),
        lane("subscriptions", [1, 1, 1, 1, 1, 1.5, 1.5, 1.5, 1.5]),
    ])
    expect(report.lanes.map(item => item.decision.outcome)).toEqual([
        "inconclusive",
        "inconclusive",
    ])
    expect(report.lanes[1]!.decision.flags).toContain("bimodal")
    expect(report.summary.counts).toEqual({
        regression: 0,
        "within-budget": 0,
        inconclusive: 2,
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
        lane("transactions", Array(9).fill(1.02)),
    ])
    expect(report.summary.counts).toEqual({
        regression: 0,
        "within-budget": 1,
        inconclusive: 0,
    })
    expect(report.summary.timingBlocks).toBe(false)
})
