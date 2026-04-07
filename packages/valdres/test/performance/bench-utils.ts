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

// ── IQR-based outlier removal ─────────────────────────────────────────────
// Mitata only trims 1 sample from each end. For sub-microsecond benchmarks
// on shared CI runners, GC pauses and CPU throttling create fat tails that
// contaminate even the median. IQR filtering removes those before we compute
// the final value.

interface TrimmedResult {
    median: number
    cv: number // coefficient of variation (stddev / mean)
    kept: number // samples kept after filtering
    total: number // total samples before filtering
}

function iqrTrimmed(rawSamples: number[]): TrimmedResult {
    const sorted = [...rawSamples].sort((a, b) => a - b)
    const n = sorted.length

    if (n < 4) {
        // Too few samples for IQR — return plain median
        const mid = Math.floor(n / 2)
        const median =
            n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
        return { median, cv: 0, kept: n, total: n }
    }

    const q1 = sorted[Math.floor(n * 0.25)]
    const q3 = sorted[Math.floor(n * 0.75)]
    const iqr = q3 - q1
    const lower = q1 - 1.5 * iqr
    const upper = q3 + 1.5 * iqr
    let filtered = sorted.filter(s => s >= lower && s <= upper)
    if (filtered.length === 0) filtered = sorted // fall back if IQR nukes everything

    // Median of filtered
    const mid = Math.floor(filtered.length / 2)
    const median =
        filtered.length % 2 !== 0
            ? filtered[mid]
            : (filtered[mid - 1] + filtered[mid]) / 2

    // Coefficient of variation
    const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length
    const variance =
        filtered.reduce((a, b) => a + (b - mean) ** 2, 0) / filtered.length
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0

    return { median, cv, kept: filtered.length, total: n }
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

    // IQR-filter raw samples, then take median — much more resistant to
    // GC pauses and CPU throttling than mitata's built-in p50
    const valdres = iqrTrimmed(valdresStats.samples)
    const competitor = iqrTrimmed(competitorStats.samples)

    const ratio = valdres.median / competitor.median
    const speedup = competitor.median / valdres.median

    const tag =
        ratio <= 1.0
            ? `${speedup.toFixed(1)}x faster`
            : `${ratio.toFixed(1)}x slower`

    const trimInfo =
        valdres.kept < valdres.total || competitor.kept < competitor.total
            ? ` [trimmed ${valdres.total - valdres.kept}+${competitor.total - competitor.kept} outliers]`
            : ""

    console.log(
        `  ${name}: valdres=${fmtNs(valdres.median)} jotai=${fmtNs(competitor.median)} (${tag})${trimInfo}`,
    )

    const result = {
        name,
        valdres: valdres.median,
        jotai: competitor.median,
        ratio,
        tag,
        threshold: maxSlowerRatio,
        cv: Math.max(valdres.cv, competitor.cv),
    }

    appendFileSync(RESULTS_PATH, JSON.stringify(result) + "\n")

    expect(ratio).toBeLessThanOrEqual(maxSlowerRatio)
}

export async function measureOne(name: string, fn: () => void) {
    const stats = await measure(fn, MEASURE_OPTS)
    const trimmed = iqrTrimmed(stats.samples)

    const trimInfo =
        trimmed.kept < trimmed.total
            ? ` [trimmed ${trimmed.total - trimmed.kept} outliers]`
            : ""

    console.log(`  ${name}: ${fmtNs(trimmed.median)}${trimInfo}`)

    const result = {
        name,
        valdres: trimmed.median,
        jotai: 0,
        ratio: 0,
        tag: "baseline",
        cv: trimmed.cv,
    }

    appendFileSync(RESULTS_PATH, JSON.stringify(result) + "\n")
    return stats
}

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    return `${(ns / 1_000_000).toFixed(2)}ms`
}
