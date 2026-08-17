import { measure } from "mitata"
import { appendFileSync } from "fs"
import { randomUUID } from "crypto"
import { join } from "path"
import { fileURLToPath } from "url"
import {
    BENCHMARK_RESULT_SCHEMA_VERSION,
    type BenchmarkObservation,
    type BenchmarkSide,
} from "./benchmark-result-schema"

const RUNTIME = typeof Bun !== "undefined" ? "bun" : "node"
const __dir =
    typeof Bun !== "undefined"
        ? import.meta.dir
        : join(fileURLToPath(import.meta.url), "..")
const RESULTS_FILE =
    RUNTIME === "bun" ? "bench-results.ndjson" : "bench-results-node.ndjson"
const RESULTS_PATH = join(__dir, RESULTS_FILE)
const RUN_ID = `${RUNTIME}-${process.pid}-${randomUUID()}`

function positiveIntegerEnv(name: string, fallback: number): number {
    const raw = process.env[name]
    if (raw === undefined) return fallback
    const value = Number(raw)
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer, received ${raw}`)
    }
    return value
}

function nonEmptyEnv(name: string, fallback: string): string {
    const value = process.env[name] ?? fallback
    if (value.length === 0) throw new Error(`${name} must not be empty`)
    return value
}

function benchmarkSide(): BenchmarkSide {
    const side = process.env.BENCH_SIDE ?? "head"
    if (side !== "base" && side !== "head") {
        throw new Error(`BENCH_SIDE must be base or head, received ${side}`)
    }
    return side
}

const RUN_CONTEXT = {
    pairId: nonEmptyEnv("BENCH_PAIR_ID", "local"),
    side: benchmarkSide(),
    order: positiveIntegerEnv("BENCH_ORDER", 1),
    suite: nonEmptyEnv("BENCH_SUITE", "local"),
}

type ObservationStats = Pick<
    Awaited<ReturnType<typeof measure>>,
    "p25" | "p50" | "p75" | "p99" | "ticks" | "samples"
>

type TierDiagnostics = Pick<
    BenchmarkObservation,
    "tierWindows" | "tierSettled" | "tierDiscardedP50s"
>

/** Convert Mitata stats to the compact, versioned row written to NDJSON. */
export function toBenchmarkObservation(
    benchmark: string,
    stats: ObservationStats,
    tier?: TierDiagnostics,
): BenchmarkObservation {
    return {
        schemaVersion: BENCHMARK_RESULT_SCHEMA_VERSION,
        kind: "latency",
        unit: "ns",
        benchmark,
        ...RUN_CONTEXT,
        runtime: RUNTIME,
        runId: RUN_ID,
        processId: process.pid,
        p25: stats.p25,
        p50: stats.p50,
        p75: stats.p75,
        p99: stats.p99,
        ticks: stats.ticks,
        sampleCount: stats.samples.length,
        ...tier,
    }
}

// Measurement budget. 100ms per benchmark keeps the suite cheap enough to run
// four to twelve paired times in the relative gate. Operations slower than
// mitata's 65µs batch threshold get 20 warm-up calls so Node reaches a stable
// JIT tier before sampling; fast operations enter batched measurement after
// the first warm-up regardless of this ceiling. Balanced paired log-ratios
// drive the primary gate; the first three ratios also feed the unchanged
// minimum-ratio catastrophic backstop.
//
// NOTE: every result is appended to one shared NDJSON file, so the suite MUST
// run serially — bun via `--concurrency 1`, vitest via pool=forks + singleFork.
const MEASURE_ONE_OPTS = {
    min_samples: 12,
    min_cpu_time: 100 * 1e6,
    warmup_samples: 20,
}

// Tier-settle protocol for per-operation async benchmarks. Mitata generates a
// fresh measurement loop per measure() call, so the recorded window starts in
// JSC's interpreter and contains the whole LLInt→Baseline→DFG→FTL ramp — for
// microsecond-scale async operations the ramp spans tens of thousands of
// executions, a large fraction of the window, and the 12-sample p50 flips
// between tiers from process to process. JSC's code cache reuses the tiered
// code across identical generated loops, so discarding whole windows until two
// consecutive window p50s agree measures the settled tier. Mid-ramp windows
// disagree by 15-45%; settled windows agree within ~2-4% on both engines, so
// the 5% tolerance separates the two regimes rather than tuning either. Every
// discarded window's p50 is recorded, and a process that never settles is
// flagged, never silently averaged.
const TIER_SETTLE_TOLERANCE = 0.05
const TIER_SETTLE_MAX_WINDOWS = 5

/**
 * Discard measurement windows until two consecutive window p50s agree within
 * the tolerance or the window cap is reached, and report the final window.
 * `first` is the already-measured opening window; `nextWindow` produces one
 * further full window per call. Exported for deterministic tests — production
 * callers go through `measureOne`.
 */
export async function settleTier<Stats extends { p50: number }>(
    first: Stats,
    nextWindow: () => Promise<Stats>,
): Promise<{ stats: Stats; tier: TierDiagnostics }> {
    const discarded: number[] = []
    let settled = false
    let stats = first
    while (!settled && discarded.length < TIER_SETTLE_MAX_WINDOWS - 1) {
        discarded.push(stats.p50)
        const next = await nextWindow()
        settled =
            Math.abs(Math.log(next.p50 / stats.p50)) <= TIER_SETTLE_TOLERANCE
        stats = next
    }
    return {
        stats,
        tier: {
            tierWindows: discarded.length + 1,
            tierSettled: settled,
            tierDiscardedP50s: discarded,
        },
    }
}

// Record compact percentile diagnostics for one benchmark. mitata's measure()
// already returns a robust, tail-trimmed p50. CI repeats the suite; the primary
// PR gate analyzes paired log-ratios, while the catastrophic backstop uses the
// smallest of its first three paired p50 ratios. The raw sample array stays
// in-process and is represented in NDJSON only by sampleCount.
export async function measureOne(
    name: string,
    fn: () => void | Promise<void>,
    options?: { warmupRuns?: number; tierSettle?: boolean },
) {
    // Mitata moves fast operations directly into batched measurement after one
    // warm-up, regardless of warmup_samples. Promise-heavy benchmarks can then
    // compare different JIT tiers across fresh processes. A targeted benchmark
    // may request explicit unmeasured calls so both base and head reach their
    // steady tier before Mitata samples them.
    for (let i = 0; i < (options?.warmupRuns ?? 0); i++) await fn()
    let stats = await measure(fn, MEASURE_ONE_OPTS)

    let tier: TierDiagnostics | undefined
    if (options?.tierSettle) {
        const settlement = await settleTier(stats, () =>
            measure(fn, MEASURE_ONE_OPTS),
        )
        stats = settlement.stats
        tier = settlement.tier
    }
    console.log(`  ${name}: ${fmtNs(stats.p50)}`)

    const result = toBenchmarkObservation(name, stats, tier)
    appendFileSync(RESULTS_PATH, JSON.stringify(result) + "\n")
    return stats
}

// Measure valdres and a reference implementation for the same operation as two
// separate `latency` benchmarks — "<op> / valdres" and "<op> / <ref>". The
// comparison is read off an overlaid Bencher plot. Main also uses a fixed set of
// pinned-Jotai series to normalize runner-wide slowdown; PRs gate Valdres only.
// The two sides use independent measurement windows so each retains a robust p50.
export async function compare(
    op: string,
    valdresFn: () => void,
    refFn: () => void,
    refName: string = "jotai",
) {
    await measureOne(`${op} / valdres`, valdresFn)
    // BENCH_VALDRES_ONLY skips the reference measurement. The PR gate sets it
    // because reference benches can't regress from a valdres change and are
    // excluded from the gate anyway — skipping them ~halves PR bench time. The
    // base lane leaves it unset so the head-to-head perf page stays populated.
    if (process.env.BENCH_VALDRES_ONLY) return
    await measureOne(`${op} / ${refName}`, refFn)
}

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    return `${(ns / 1_000_000).toFixed(2)}ms`
}
