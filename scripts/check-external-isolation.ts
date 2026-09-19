import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
    DEFAULT_PAIRED_POLICY,
    decidePairedRun,
    type PairedOutcome,
    type PairedComparison,
} from "./lib/paired-decision"
import { isSubMicrosecond, TIMING_FLOOR_NS } from "./lib/bench-protected-set"
import { median } from "./lib/median"

type Arm = "baseline" | "installed"
const PAIRS = 8

function pairOrder(index: number): readonly [Arm, Arm] {
    return index % 2 ? ["installed", "baseline"] : ["baseline", "installed"]
}

/** Four complete B-P-P-B blocks, with each arm measured in a fresh process. */
export function collectExternalIsolation(measure: (arm: Arm) => number) {
    return Array.from({ length: PAIRS }, (_, index) => {
        const order = pairOrder(index)
        const timing = { baseline: 0, installed: 0 }
        for (const arm of order) timing[arm] = measure(arm)
        return {
            ...timing,
            ratio: timing.installed / timing.baseline,
            order,
        }
    })
}

interface IsolationLane {
    engine: string
    version: string
    workload: string
    measurements: ReturnType<typeof collectExternalIsolation>
}

export function reportExternalIsolation(lanes: IsolationLane[]) {
    if (lanes.length === 0) throw new Error("No isolation measurements")
    const comparisons: PairedComparison[] = lanes.map(lane => {
        if (lane.measurements.length !== PAIRS)
            throw new Error(
                "External isolation requires exactly eight balanced pairs",
            )
        for (const [index, measurement] of lane.measurements.entries()) {
            const expected = pairOrder(index)
            if (
                !Array.isArray(measurement.order) ||
                measurement.order.length !== 2 ||
                measurement.order[0] !== expected[0] ||
                measurement.order[1] !== expected[1]
            )
                throw new Error(
                    "External isolation requires balanced B-P-P-B order",
                )
            if (
                !Number.isFinite(measurement.baseline) ||
                measurement.baseline <= 0 ||
                !Number.isFinite(measurement.installed) ||
                measurement.installed <= 0 ||
                !Number.isFinite(measurement.ratio) ||
                measurement.ratio !==
                    measurement.installed / measurement.baseline
            )
                throw new Error("Invalid isolation measurement")
        }
        // Match the repository policy: the median BASELINE operation time
        // determines the floor, regardless of the candidate's measured cost.
        const belowFloor = isSubMicrosecond(
            median(lane.measurements.map(item => item.baseline)),
        )
        return {
            benchmark: lane.workload,
            runtime: lane.engine,
            suite: "external-installed-unrelated",
            family: belowFloor ? "informational" : "protected",
            subMicrosecond: belowFloor,
            samples: lane.measurements.map((measurement, index) => ({
                pairId: String(index),
                baseNs: measurement.baseline,
                headNs: measurement.installed,
            })),
            unpairedBase: 0,
            unpairedHead: 0,
        }
    })
    const decisions = decidePairedRun(comparisons)
    const results = lanes.map((lane, index) => {
        const decision = decisions[index]!
        // The shared estimator correctly declines a single verdict for two
        // process states. That uncertainty must not green-light a protected
        // lane, including when BOTH states regress. Fail certification closed
        // without relabelling the statistical outcome as a regression.
        // Also backstop unanimous strict exceedance at the fixed eight-pair
        // cap, independently of modality: one-sided sign p = 2^-8 = 1/256;
        // Bonferroni across all eight lanes is 8/256 = 0.03125 < 0.05.
        const blockingReason =
            decision.family !== "protected"
                ? null
                : decision.flags.includes("bimodal")
                  ? "unresolved protected bimodality"
                  : decision.outcome === "regression"
                    ? "protected regression"
                    : lane.measurements.every(
                            measurement =>
                                measurement.ratio >
                                1 + DEFAULT_PAIRED_POLICY.budgetPct,
                        )
                      ? "unanimous protected over-budget pairs"
                      : null
        return { ...lane, decision, blockingReason }
    })
    const counts: Record<PairedOutcome, number> = {
        regression: 0,
        "within-budget": 0,
        inconclusive: 0,
    }
    const countsByFamily = {
        protected: { ...counts },
        informational: { ...counts },
    }
    for (const decision of decisions) {
        counts[decision.outcome]++
        countsByFamily[decision.family][decision.outcome]++
    }
    return {
        lanes: results,
        summary: {
            counts,
            countsByFamily,
            timingBlocks: results.some(lane => lane.blockingReason !== null),
            pairs: PAIRS,
            order: "B-P-P-B",
            timingFloorNs: TIMING_FLOOR_NS,
            policy: DEFAULT_PAIRED_POLICY,
            inconclusivePolicy:
                "Protected regressions, unresolved protected bimodality, and unanimous protected over-budget pairs block. Other inconclusive results are non-blocking; inconclusive does not establish slowdown <=10%.",
            informationalPolicy:
                "Baseline median below the timing floor is informational, including regression or bimodality; no A/A-calibrated exception is claimed.",
            primaryBlockingCertificate:
                "packages/valdres/test/v1-committed-store-tree/external-isolation.test.ts: zero planes and zero operations on unrelated trees",
        },
    }
}

// Each arm/workload gets a fresh process: installing a runtime cannot be undone.
// Retain four balanced B-P-P-B blocks per lane and their execution order.
// Use the existing paired model (10% budget; FDR adjustment within each family).
// Structural zero-plane/zero-operation tests are the primary blocking certificate.
async function main() {
    const directory = await mkdtemp(
        join(tmpdir(), "valdres-external-isolation-"),
    )
    const lanes: IsolationLane[] = []
    try {
        const build = await Bun.build({
            entrypoints: [
                join(import.meta.dir, "fixtures/external-isolation.ts"),
            ],
            outdir: directory,
            target: "node",
            format: "esm",
            naming: "[name].mjs",
            define: { "process.env.NODE_ENV": '"production"' },
        })
        if (!build.success)
            throw new AggregateError(build.logs, "Fixture build failed")
        const node = Bun.which("node")
        if (!node)
            throw new Error(
                "Node is required for external isolation certification",
            )
        for (const [engine, executable] of [
            ["bun", process.execPath],
            ["node", node],
        ] as const) {
            const version = Bun.spawnSync([executable, "--version"])
            if (version.exitCode !== 0)
                throw new Error("Cannot identify benchmark engine")
            for (const workload of [
                "reads",
                "subscriptions",
                "writes",
                "transactions",
            ]) {
                const measurements = collectExternalIsolation(arm => {
                    const child = Bun.spawnSync({
                        cmd: [
                            executable,
                            join(directory, "external-isolation.mjs"),
                            workload,
                            arm,
                        ],
                        stdout: "pipe",
                        stderr: "pipe",
                    })
                    if (child.exitCode !== 0)
                        throw new Error(child.stderr.toString())
                    const output = JSON.parse(child.stdout.toString())
                    if (
                        !(output.ns > 0) ||
                        !Number.isFinite(output.ns) ||
                        output.samples !== 0
                    )
                        throw new Error("Invalid measurement")
                    return output.ns
                })
                const lane = {
                    engine,
                    version: version.stdout.toString().trim(),
                    workload,
                    measurements,
                }
                lanes.push(lane)
                console.log(JSON.stringify({ kind: "measurement", ...lane }))
            }
        }
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
    const report = reportExternalIsolation(lanes)
    for (const lane of report.lanes)
        console.log(JSON.stringify({ kind: "decision", ...lane }))
    console.log(JSON.stringify({ kind: "summary", ...report.summary }))
    if (report.summary.timingBlocks)
        throw new Error(
            `ExternalAtom timing certification blocked: ${report.lanes
                .filter(lane => lane.blockingReason !== null)
                .map(
                    lane =>
                        `${lane.engine} ${lane.workload}: ${lane.blockingReason}`,
                )
                .join(", ")}`,
        )
}

if (import.meta.main) await main()
