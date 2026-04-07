import { expect } from "bun:test"
import { measure } from "mitata"
import { appendFileSync } from "fs"
import { join } from "path"

const RESULTS_PATH = join(import.meta.dir, "bench-results.ndjson")

// Increase min samples and CPU time for more stable results.
// Defaults: min_samples=2, min_cpu_time=642ms, warmup_samples=2
const MEASURE_OPTS = {
    min_samples: 20,
    min_cpu_time: 1_500 * 1e6, // 1.5s in nanoseconds
    warmup_samples: 5,
}

export async function assertFaster(
    name: string,
    valdresFn: () => void,
    competitorFn: () => void,
    maxSlowerRatio: number = 1.0,
) {
    // Deterministic but varied measurement order to eliminate systematic bias
    // Derive from benchmark name so results are reproducible across runs
    const hash = name.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
    const runValdresFirst = hash % 2 === 0
    const [firstStats, secondStats] = runValdresFirst
        ? [await measure(valdresFn, MEASURE_OPTS), await measure(competitorFn, MEASURE_OPTS)]
        : [await measure(competitorFn, MEASURE_OPTS), await measure(valdresFn, MEASURE_OPTS)]
    const valdresStats = runValdresFirst ? firstStats : secondStats
    const competitorStats = runValdresFirst ? secondStats : firstStats

    // Use median (p50) instead of avg — resistant to GC-pause outliers
    const ratio = valdresStats.p50 / competitorStats.p50
    const speedup = competitorStats.p50 / valdresStats.p50

    const tag =
        ratio <= 1.0
            ? `${speedup.toFixed(1)}x faster`
            : `${ratio.toFixed(1)}x slower`

    console.log(
        `  ${name}: valdres=${fmtNs(valdresStats.p50)} jotai=${fmtNs(competitorStats.p50)} (${tag})`,
    )

    const result = {
        name,
        valdres: valdresStats.p50,
        jotai: competitorStats.p50,
        ratio,
        tag,
        threshold: maxSlowerRatio,
    }

    appendFileSync(RESULTS_PATH, JSON.stringify(result) + "\n")

    expect(ratio).toBeLessThanOrEqual(maxSlowerRatio)
}

export async function measureOne(name: string, fn: () => void) {
    const stats = await measure(fn, MEASURE_OPTS)

    console.log(`  ${name}: ${fmtNs(stats.p50)}`)

    const result = {
        name,
        valdres: stats.p50,
        jotai: 0,
        ratio: 0,
        tag: "baseline",
    }

    appendFileSync(RESULTS_PATH, JSON.stringify(result) + "\n")
    return stats
}

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    return `${(ns / 1_000_000).toFixed(2)}ms`
}
