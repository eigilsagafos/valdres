import { expect } from "./test-compat"
import { measure } from "mitata"
import { appendFileSync } from "fs"
import { join } from "path"
import { fileURLToPath } from "url"

// Nanosecond clock. Bun exposes a native ns counter; everything else
// falls back to performance.now() scaled to ns. Same strategy mitata
// uses internally (its `now` isn't re-exported from the main entry).
const now: () => number =
    typeof Bun !== "undefined" && typeof Bun.nanoseconds === "function"
        ? Bun.nanoseconds
        : () => Math.ceil(1e6 * performance.now())

const RUNTIME = typeof Bun !== "undefined" ? "bun" : "node"
const __dir = typeof Bun !== "undefined"
    ? import.meta.dir
    : join(fileURLToPath(import.meta.url), "..")
const RESULTS_FILE = RUNTIME === "bun" ? "bench-results.ndjson" : "bench-results-node.ndjson"
const RESULTS_PATH = join(__dir, RESULTS_FILE)

// ── Paired per-batch measurement ─────────────────────────────────────────
// The original back-to-back model ran each side for 1.5s in a fixed order.
// A single noisy CPU window during one side's run could shift its median 2×
// while the other side ran clean, blowing the ratio up even when neither
// implementation changed.
//
// This pairs at the per-batch level — alternating ~30µs batches of valdres
// and competitor — so any CPU stall hits both numerator and denominator in
// the same ~60µs window and cancels out of the ratio. The pairing is so
// tight statistically that the wall-clock budget per assertion drops from
// ~3s to ~100ms while ratio stability *improves*.
const PROBE_OPTS = {
    min_samples: 4,
    min_cpu_time: 20 * 1e6, // 20ms probe per side — enough to nail down per-op time
    warmup_samples: 2,
}
// Sample count is sized by total wall-clock budget rather than a fixed N —
// fast benchmarks get many samples (cheap to gather), slow ones get fewer
// (each pair already represents a lot of work). 50 is the floor for a
// statistically meaningful median ratio.
const TARGET_MEASUREMENT_NS = 50 * 1e6 // ~50ms measurement per assertion
const MIN_PAIRED_SAMPLES = 50
const MAX_PAIRED_SAMPLES = 2000
const TARGET_SLOW_BATCH_NS = 30_000 // slow side ≈ 30µs per batch
const TARGET_FAST_BATCH_NS = 5_000 // faster side ≥ 5µs — well above timer noise
const MAX_BATCH_SIZE = 100_000
const WARMUP_ITERS = 200

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
    if (rawSamples.length === 0) {
        throw new Error("iqrTrimmed: received empty samples array")
    }

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
    refName: string = "jotai",
) {
    // Probe — short mitata measurement on each side to estimate per-op time.
    // The probe pays its own warmup cost so the main loop can use static
    // batches without the JIT swallowing a tier-up mid-measurement.
    const vProbe = await measure(valdresFn, PROBE_OPTS)
    const cProbe = await measure(competitorFn, PROBE_OPTS)
    const vNs = vProbe.p50
    const cNs = cProbe.p50

    // Batch sized so the slow side reaches ~30µs (well above timer
    // resolution) and the fast side stays at ≥5µs. One shared batch
    // size keeps the pairing tight and the loop branch-free.
    const slowNs = Math.max(vNs, cNs)
    const fastNs = Math.min(vNs, cNs)
    const batchSize = Math.max(
        1,
        Math.min(
            MAX_BATCH_SIZE,
            Math.ceil(
                Math.max(
                    TARGET_SLOW_BATCH_NS / slowNs,
                    TARGET_FAST_BATCH_NS / fastNs,
                ),
            ),
        ),
    )

    // Adaptive sample count — divide the wall-clock budget by what one
    // pair actually costs. Fast benchmarks get thousands of pairs; slow
    // ones get the floor (50).
    const pairDurationNs = batchSize * (vNs + cNs)
    const pairedSamples = Math.max(
        MIN_PAIRED_SAMPLES,
        Math.min(
            MAX_PAIRED_SAMPLES,
            Math.floor(TARGET_MEASUREMENT_NS / pairDurationNs),
        ),
    )

    // Shared warmup — runs both functions interleaved so the JIT sees the
    // exact call pattern the measurement loop will use. Warmup iterations
    // scale with op cost so we don't waste seconds on slow benches.
    const warmupIters = Math.min(WARMUP_ITERS, Math.max(5, pairedSamples >> 2))
    for (let i = 0; i < warmupIters; i++) {
        valdresFn()
        competitorFn()
    }

    // Paired per-batch measurement. Each iteration:
    //   1. time a batch of valdresFn
    //   2. time a batch of competitorFn (immediately, same noise window)
    // Alternating which side runs first per pair removes any
    // "first-runner pays the cache miss" bias.
    const valdresSamples = new Array<number>(pairedSamples)
    const competitorSamples = new Array<number>(pairedSamples)

    for (let i = 0; i < pairedSamples; i++) {
        if ((i & 1) === 0) {
            const t0 = now()
            for (let j = 0; j < batchSize; j++) valdresFn()
            const t1 = now()
            for (let j = 0; j < batchSize; j++) competitorFn()
            const t2 = now()
            valdresSamples[i] = (t1 - t0) / batchSize
            competitorSamples[i] = (t2 - t1) / batchSize
        } else {
            const t0 = now()
            for (let j = 0; j < batchSize; j++) competitorFn()
            const t1 = now()
            for (let j = 0; j < batchSize; j++) valdresFn()
            const t2 = now()
            competitorSamples[i] = (t1 - t0) / batchSize
            valdresSamples[i] = (t2 - t1) / batchSize
        }
    }

    // Per-pair ratios — this is the authoritative measurement. Each ratio
    // shares its own ~60µs noise window, so CPU stalls cancel.
    const pairRatios = new Array<number>(pairedSamples)
    for (let i = 0; i < pairedSamples; i++) {
        pairRatios[i] = valdresSamples[i] / competitorSamples[i]
    }
    pairRatios.sort((a, b) => a - b)
    const ratio = pairRatios[Math.floor(pairedSamples / 2)]
    const speedup = 1 / ratio

    // Per-side trimmed medians for the BENCHMARKS.md table / NDJSON output.
    const valdres = iqrTrimmed(valdresSamples)
    const competitor = iqrTrimmed(competitorSamples)

    const tag =
        ratio <= 1.0
            ? `${speedup.toFixed(1)}x faster`
            : `${ratio.toFixed(1)}x slower`

    // p10/p90 of paired ratios — narrow band means the methodology
    // converged. Wide band means the run was noisy and the median
    // absorbed it; the assertion is still meaningful.
    const p10 = pairRatios[Math.floor(pairedSamples * 0.1)]
    const p90 = pairRatios[Math.floor(pairedSamples * 0.9)]
    const spreadInfo = ` [pair p10–p90 ${p10.toFixed(2)}–${p90.toFixed(2)}, n=${pairedSamples}, batch=${batchSize}]`

    console.log(
        `  ${name}: valdres=${fmtNs(valdres.median)} ${refName}=${fmtNs(competitor.median)} (${tag})${spreadInfo}`,
    )

    const result = {
        kind: "compare",
        op: name,
        ref: refName,
        valdresNs: valdres.median,
        refNs: competitor.median,
        ratio,
        ratioP10: p10,
        ratioP90: p90,
        cv: Math.max(valdres.cv, competitor.cv),
        threshold: maxSlowerRatio,
    }

    appendFileSync(RESULTS_PATH, JSON.stringify(result) + "\n")

    expect(ratio).toBeLessThanOrEqual(maxSlowerRatio)
}

// Baseline reference measurements (obj.value, map.get, etc.) — no assertion,
// just a single-side number for the BENCHMARKS.md table. Pair-based timing
// isn't useful here, so we lean on mitata with a modest budget.
const MEASURE_ONE_OPTS = {
    min_samples: 10,
    min_cpu_time: 200 * 1e6,
    warmup_samples: 2,
}

export async function measureOne(name: string, fn: () => void) {
    const stats = await measure(fn, MEASURE_ONE_OPTS)
    const trimmed = iqrTrimmed(stats.samples)

    const trimInfo =
        trimmed.kept < trimmed.total
            ? ` [trimmed ${trimmed.total - trimmed.kept} outliers]`
            : ""

    console.log(`  ${name}: ${fmtNs(trimmed.median)}${trimInfo}`)

    const result = {
        kind: "latency",
        name,
        ns: trimmed.median,
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
