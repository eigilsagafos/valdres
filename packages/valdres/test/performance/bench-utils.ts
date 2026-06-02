import { measure } from "mitata"
import { appendFileSync } from "fs"
import { join } from "path"
import { fileURLToPath } from "url"

const RUNTIME = typeof Bun !== "undefined" ? "bun" : "node"
const __dir =
    typeof Bun !== "undefined"
        ? import.meta.dir
        : join(fileURLToPath(import.meta.url), "..")
const RESULTS_FILE =
    RUNTIME === "bun" ? "bench-results.ndjson" : "bench-results-node.ndjson"
const RESULTS_PATH = join(__dir, RESULTS_FILE)

// Measurement budget. 200ms keeps the full suite under the CI step budget;
// Bencher's per-benchmark t-test absorbs the extra per-point variance across
// commits, so we don't need mitata's heavier default (642ms) here.
//
// NOTE: every result is appended to one shared NDJSON file, so the suite MUST
// run serially — bun via `--concurrency 1`, vitest via pool=forks + singleFork.
const MEASURE_ONE_OPTS = {
    min_samples: 12,
    min_cpu_time: 200 * 1e6,
    warmup_samples: 2,
}

// Record one absolute latency (ns) for a benchmark. mitata's measure() already
// returns a robust, tail-trimmed p50; Bencher's t-test owns cross-run noise, so
// we report p50 directly with no extra outlier filtering.
export async function measureOne(name: string, fn: () => void) {
    const stats = await measure(fn, MEASURE_ONE_OPTS)
    console.log(`  ${name}: ${fmtNs(stats.p50)}`)

    const result = { kind: "latency", name, ns: stats.p50 }
    appendFileSync(RESULTS_PATH, JSON.stringify(result) + "\n")
    return stats
}

// Measure valdres and a reference implementation for the same operation as two
// separate `latency` benchmarks — "<op> / valdres" and "<op> / <ref>". The
// comparison is read off an overlaid Bencher plot; each series is gated against
// its own history. The two sides are measured in independent windows on purpose
// (no in-process ratio) — Bencher is the gate.
export async function compare(
    op: string,
    valdresFn: () => void,
    refFn: () => void,
    refName: string = "jotai",
) {
    await measureOne(`${op} / valdres`, valdresFn)
    await measureOne(`${op} / ${refName}`, refFn)
}

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    return `${(ns / 1_000_000).toFixed(2)}ms`
}
