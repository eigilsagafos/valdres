import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

// Each arm/workload gets a fresh process: installing a runtime cannot be undone.
// Alternate arm order; report every paired ratio, never pool different lanes.
// A one-sided 95% lower confidence bound above 1.10 is a credible regression.
const directory = await mkdtemp(join(tmpdir(), "valdres-external-isolation-"))
const pairs = 9
const failures: string[] = []
try {
    const build = await Bun.build({
        entrypoints: [join(import.meta.dir, "fixtures/external-isolation.ts")],
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
        throw new Error("Node is required for external isolation certification")
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
            const logs = measurements.map(item => Math.log(item.ratio))
            const mean = logs.reduce((a, b) => a + b) / pairs
            const variance =
                logs.reduce((sum, n) => sum + (n - mean) ** 2, 0) / (pairs - 1)
            // Student t, df=8, one-sided 95%. Keep pair count and quantile together.
            const margin = 1.859548 * Math.sqrt(variance / pairs)
            const lower95 = Math.exp(mean - margin)
            const upper95 = Math.exp(mean + margin)
            const result = {
                engine,
                version: version.stdout.toString().trim(),
                workload,
                ratio: Math.exp(mean),
                lower95,
                upper95,
                measurements,
            }
            console.log(JSON.stringify(result))
            if (lower95 > 1.1)
                failures.push(
                    `${engine} ${workload}: ${(Math.exp(mean) * 100 - 100).toFixed(1)}% slower (lower bound ${(lower95 * 100 - 100).toFixed(1)}%)`,
                )
        }
    }
} finally {
    await rm(directory, { recursive: true, force: true })
}
if (failures.length)
    throw new Error(`Unused ExternalAtom regressions:\n${failures.join("\n")}`)
