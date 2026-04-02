import { expect } from "bun:test"
import { measure } from "mitata"
import { appendFileSync } from "fs"
import { join } from "path"

const RESULTS_PATH = join(import.meta.dir, "bench-results.ndjson")

export async function assertFaster(
    name: string,
    valdresFn: () => void,
    competitorFn: () => void,
    maxSlowerRatio: number = 1.0,
) {
    // Run sequentially to avoid CPU contention between measurements
    const valdresStats = await measure(valdresFn)
    const competitorStats = await measure(competitorFn)

    const ratio = valdresStats.avg / competitorStats.avg
    const speedup = competitorStats.avg / valdresStats.avg

    const tag =
        ratio <= 1.0
            ? `${speedup.toFixed(1)}x faster`
            : `${ratio.toFixed(1)}x slower`

    console.log(
        `  ${name}: valdres=${fmtNs(valdresStats.avg)} jotai=${fmtNs(competitorStats.avg)} (${tag})`,
    )

    const result = {
        name,
        valdres: valdresStats.avg,
        jotai: competitorStats.avg,
        ratio,
        tag,
    }

    appendFileSync(RESULTS_PATH, JSON.stringify(result) + "\n")

    expect(ratio).toBeLessThanOrEqual(maxSlowerRatio)
}

export async function measureOne(name: string, fn: () => void) {
    const stats = await measure(fn)

    console.log(`  ${name}: ${fmtNs(stats.avg)}`)

    const result = {
        name,
        valdres: stats.avg,
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
