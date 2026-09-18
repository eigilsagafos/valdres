import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
    DEFAULT_PAIRED_POLICY,
    decidePairedRun,
    type PairedOutcome,
} from "./lib/paired-decision"

interface IsolationLane {
    engine: string
    version: string
    workload: string
    measurements: { baseline: number; installed: number; ratio: number }[]
}

export function reportExternalIsolation(lanes: IsolationLane[]) {
    const decisions = decidePairedRun(
        lanes.map(lane => ({
            benchmark: lane.workload,
            runtime: lane.engine,
            suite: "external-installed-unrelated",
            family: "protected",
            samples: lane.measurements.map((measurement, index) => ({
                pairId: String(index),
                baseNs: measurement.baseline,
                headNs: measurement.installed,
            })),
            unpairedBase: 0,
            unpairedHead: 0,
        })),
    )
    const counts: Record<PairedOutcome, number> = {
        regression: 0,
        "within-budget": 0,
        inconclusive: 0,
    }
    for (const decision of decisions) counts[decision.outcome]++
    return {
        lanes: lanes.map((lane, index) => ({
            ...lane,
            decision: decisions[index]!,
        })),
        summary: {
            counts,
            timingBlocks: counts.regression > 0,
            policy: DEFAULT_PAIRED_POLICY,
            inconclusivePolicy:
                "Regression blocks; inconclusive does not establish slowdown <=10% and is non-blocking.",
            primaryBlockingCertificate:
                "packages/valdres/test/v1-committed-store-tree/external-isolation.test.ts: zero planes and zero operations on unrelated trees",
        },
    }
}

// Each arm/workload gets a fresh process: installing a runtime cannot be undone.
// Alternate arm order and retain every pair. Classify the eight lanes together
// with the existing paired model (10% budget; FDR adjustment across the family).
// Structural zero-plane/zero-operation tests are the primary blocking certificate.
async function main() {
    const directory = await mkdtemp(
        join(tmpdir(), "valdres-external-isolation-"),
    )
    const pairs = 9
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
                const measurements: {
                    baseline: number
                    installed: number
                    ratio: number
                }[] = []
                for (let pair = 0; pair < pairs; pair++) {
                    const timing: Record<string, number> = {}
                    for (const arm of pair % 2
                        ? ["installed", "baseline"]
                        : ["baseline", "installed"]) {
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
                        timing[arm] = output.ns
                    }
                    measurements.push({
                        baseline: timing.baseline!,
                        installed: timing.installed!,
                        ratio: timing.installed! / timing.baseline!,
                    })
                }
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
            `Unused ExternalAtom timing regressions: ${report.lanes
                .filter(lane => lane.decision.outcome === "regression")
                .map(lane => `${lane.engine} ${lane.workload}`)
                .join(", ")}`,
        )
}

if (import.meta.main) await main()
