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

// ── IQR-based outlier removal ─────────────────────────────────────────────
// Mitata only trims 1 sample from each end. For sub-microsecond benchmarks on
// shared CI runners, GC pauses and CPU throttling create fat tails that
// contaminate even the median. IQR filtering removes those before we report.
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

    const mid = Math.floor(filtered.length / 2)
    const median =
        filtered.length % 2 !== 0
            ? filtered[mid]
            : (filtered[mid - 1] + filtered[mid]) / 2

    const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length
    const variance =
        filtered.reduce((a, b) => a + (b - mean) ** 2, 0) / filtered.length
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0

    return { median, cv, kept: filtered.length, total: n }
}

// Single-side absolute latency (nanoseconds) for one implementation. Each call
// records one `latency` benchmark — the value Bencher tracks and gates against
// the base branch. Runner noise is handled by Bencher's statistical threshold,
// not by a same-window ratio here.
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

// Measure valdres and a reference implementation for the same operation as two
// separate `latency` benchmarks — "<op> / valdres" and "<op> / <ref>". The
// competitor / native-floor comparison is read off a Bencher plot (overlaid
// lines); regression gating is per-benchmark against the base branch. No
// in-process ratio or assertion: Bencher owns the gate now.
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
