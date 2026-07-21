/**
 * Converts the benchmark NDJSON (from bench-utils.ts) into Bencher Metric
 * Format (BMF), one file per runtime/testbed. Every benchmark gets the built-in
 * `latency` measure (nanoseconds — units are set automatically by Bencher).
 * When BENCH_NORMALIZE is set, gateable Valdres benchmarks also get the custom
 * `runner-normalized-latency-v1` measure. It divides latency by a fixed
 * geometric-mean index of pinned-Jotai controls from the same run, cancelling
 * runner-wide slowdown while preserving Valdres-specific regressions.
 *
 * Each benchmark is one implementation of an operation, named "<op> / <impl>"
 * (e.g. "store.get(atom) / valdres", "store.get(atom) / jotai",
 * "store.get(atom) / map"). The competitor / native-floor comparison is read
 * off a Bencher plot by overlaying the sibling benchmarks. PRs gate Valdres
 * latency against a same-runner base; main gates only the normalized measure.
 * Names are deduped — an implementation can be measured in more than one
 * comparison (e.g. valdres.get appears in both the vs-jotai and vs-map plots).
 *
 *   bench-results.ndjson       -> packages/valdres/bun_results.json   (testbed ubuntu-2204-bun)
 *   bench-results-node.ndjson  -> packages/valdres/node_results.json  (testbed ubuntu-2204-node)
 */
import { writeFileSync } from "fs"
import { join } from "path"
import { type BenchResult, readBenchResults } from "./lib/read-bench-results"
import { median } from "./lib/median"

type Metric = { value: number; lower_value?: number; upper_value?: number }
export type Bmf = Record<string, Record<string, Metric>>

export interface BmfOptions {
    excludeRefs?: boolean
    excludeTiny?: boolean
    normalize?: boolean
}

function samplesByName(results: BenchResult[]): Map<string, number[]> {
    const samples = new Map<string, number[]>()
    for (const result of results) {
        const values = samples.get(result.name)
        if (values) values.push(result.ns)
        else samples.set(result.name, [result.ns])
    }
    return samples
}

const ROOT = join(import.meta.dir, "..")
const PERF_DIR = join(ROOT, "packages/valdres/test/performance")

// A compare() benchmark is named "<op> / <impl>"; the reference sides are any
// impl other than valdres (jotai, map, recoil, …). Standalone valdres benches
// (e.g. "scope: set atom, …") have no " / <impl>" suffix.
function isReference(name: string): boolean {
    const m = name.match(/ \/ ([^/]+)$/)
    return m !== null && m[1] !== "valdres"
}

// The "<op>" part of a benchmark name, dropping any " / <impl>" suffix.
function opName(name: string): string {
    const m = name.match(/^(.*) \/ [^/]+$/)
    return m ? m[1] : name
}

// Operations too small to gate reliably. Their +50% relative boundary is only
// nanoseconds to low hundreds of nanoseconds — below the CI runner's JIT and
// measurement noise even after median-of-3. They remain measured and plotted
// by the base lane.
const UNGATEABLE_OPS = new Set([
    "atom(1)", // ~2ns
    "selector(fn)", // ~5ns
    "atomFamily(id)", // ~100-250ns; constructor JIT tier varies by ~100ns
    "selectorFamily(id)", // ~300ns-1.5us; covered by aggregated family workloads
    "atomFamily(id) cache hit", // ~10ns
    "atomFamily(string) cache hit", // ~25ns
    "selectorFamily(string) cache hit", // ~60ns
    // The single-call p50 flips between JIT tiers on the same runner (roughly
    // 15-40ns). The identical hot path remains gated by "get 1000 atoms",
    // whose aggregated window is stable enough for a percentage boundary.
    "store.get(atom)",
])

// Versioned because changing the control set changes the scale of every metric.
// If a control ever needs replacing, create a v2 measure instead of silently
// splicing a different scale into v1's history. Jotai is exactly pinned in the
// package manifest, and these controls span the suite from microseconds to tens
// of milliseconds so one workload or transient cannot dominate the index.
export const NORMALIZED_LATENCY_MEASURE = "runner-normalized-latency-v1"
export const RUNNER_CONTROL_BENCHMARKS = [
    "set(atom) with 10 subs / jotai",
    "atom lifecycle (create+100get+100set) / jotai",
    "sub + unsub / jotai",
    "set(atom, curr => curr+1) / jotai",
    "get 1000 atoms / jotai",
    "txn: cross-atom 1000 selectors, with subs / jotai",
    "txn: asymmetric DAG shared sink / jotai",
    "txn: large asymmetric DAG (1000 leaves × 50 chain) / jotai",
] as const

function geometricMean(values: number[]): number {
    if (
        values.length === 0 ||
        values.some(value => !Number.isFinite(value) || value <= 0)
    ) {
        throw new Error(
            "Runner controls must contain finite, positive latencies",
        )
    }
    return Math.exp(
        values.reduce((sum, value) => sum + Math.log(value), 0) / values.length,
    )
}

export function toBmf(results: BenchResult[], options: BmfOptions = {}): Bmf {
    // The relative-CB gate runs the suite multiple times and concatenates the
    // NDJSON, so a benchmark name legitimately appears once per repeat. Keep the
    // MEDIAN latency across repeats: with three runs it rejects either one slow
    // GC/scheduler sample or one anomalously fast JIT sample. Min-of-three only
    // rejected slow outliers and could turn one lucky base result into a false
    // regression. A single local run still yields median-of-one.
    //
    // BENCH_EXCLUDE_REFS drops the competitor/native-floor sides. The PR gate
    // sets it because those benches can't regress from a valdres change (jotai
    // is pinned, map is native) — gating them only adds noise. They're still
    // measured and plotted via the base lane (bencher-base.yml) for the
    // head-to-head perf page.
    const {
        excludeRefs = false,
        excludeTiny = false,
        normalize = false,
    } = options
    const latencies = new Map(
        [...samplesByName(results)].map(([name, values]) => [
            name,
            median(values),
        ]),
    )
    let runnerControlIndex: number | undefined
    if (normalize) {
        const missingControls = RUNNER_CONTROL_BENCHMARKS.filter(
            name => !latencies.has(name),
        )
        if (missingControls.length > 0) {
            throw new Error(
                `Missing runner controls: ${missingControls.join(", ")}`,
            )
        }
        runnerControlIndex = geometricMean(
            RUNNER_CONTROL_BENCHMARKS.map(name => latencies.get(name)!),
        )
    }

    const bmf: Bmf = {}
    for (const [name, latency] of latencies) {
        if (excludeRefs && isReference(name)) continue
        if (excludeTiny && UNGATEABLE_OPS.has(opName(name))) continue

        const measures: Record<string, Metric> = { latency: { value: latency } }
        // Raw latency remains available for every benchmark and for the public
        // comparison plots. Only Valdres-owned, sufficiently large benchmarks
        // get the normalized measure that main's Threshold evaluates.
        if (
            runnerControlIndex !== undefined &&
            !isReference(name) &&
            !UNGATEABLE_OPS.has(opName(name))
        ) {
            measures[NORMALIZED_LATENCY_MEASURE] = {
                value: latency / runnerControlIndex,
            }
        }
        bmf[name] = measures
    }
    return bmf
}

/**
 * Produces the head-side BMF for an interleaved relative benchmark run.
 *
 * Bencher compares this value with a separately uploaded base BMF. Scaling the
 * base median by the median of the paired head/base ratios makes that comparison
 * evaluate the paired statistic directly. Taking independent base and head
 * medians first can manufacture a regression when an order or runner effect
 * moves both measurements in only one pair.
 */
export function toPairedBmf(
    baseResults: BenchResult[],
    headResults: BenchResult[],
    options: BmfOptions = {},
): Bmf {
    if (options.normalize) {
        throw new Error("Paired BMF does not support runner normalization")
    }

    const baseBmf = toBmf(baseResults, options)
    const headBmf = toBmf(headResults, options)
    const baseNames = Object.keys(baseBmf)
    const headNames = Object.keys(headBmf)
    const missingFromHead = baseNames.filter(name => !(name in headBmf))
    const missingFromBase = headNames.filter(name => !(name in baseBmf))
    if (missingFromHead.length > 0 || missingFromBase.length > 0) {
        throw new Error(
            [
                missingFromHead.length > 0
                    ? `missing from head: ${missingFromHead.join(", ")}`
                    : "",
                missingFromBase.length > 0
                    ? `missing from base: ${missingFromBase.join(", ")}`
                    : "",
            ]
                .filter(Boolean)
                .join("; "),
        )
    }

    const baseSamples = samplesByName(baseResults)
    const headSamples = samplesByName(headResults)
    const paired: Bmf = {}
    for (const name of baseNames) {
        const base = baseSamples.get(name)!
        const head = headSamples.get(name)!
        if (base.length !== head.length) {
            throw new Error(
                `Mismatched paired sample count for ${name}: base=${base.length}, head=${head.length}`,
            )
        }
        if (
            base.length === 0 ||
            base.some(value => !Number.isFinite(value) || value <= 0) ||
            head.some(value => !Number.isFinite(value) || value <= 0)
        ) {
            throw new Error(
                `Paired samples for ${name} must be finite and positive`,
            )
        }

        const pairedRatio = median(
            head.map((value, index) => value / base[index]),
        )
        paired[name] = {
            latency: {
                value: baseBmf[name].latency.value * pairedRatio,
            },
        }
    }
    return paired
}

// Input NDJSON and output BMF paths are overridable via env so the relative-CB
// gate can run THIS (PR-checkout) script against the base worktree's results —
// the base SHA ships an older bench-to-bmf that would reject the repeated names.
const lanes = [
    {
        ndjson:
            process.env.BENCH_NDJSON_BUN ??
            join(PERF_DIR, "bench-results.ndjson"),
        pairedBase: process.env.BENCH_PAIRED_BASE_BUN,
        out:
            process.env.BENCH_OUT_BUN ??
            join(ROOT, "packages/valdres/bun_results.json"),
    },
    {
        ndjson:
            process.env.BENCH_NDJSON_NODE ??
            join(PERF_DIR, "bench-results-node.ndjson"),
        pairedBase: process.env.BENCH_PAIRED_BASE_NODE,
        out:
            process.env.BENCH_OUT_NODE ??
            join(ROOT, "packages/valdres/node_results.json"),
    },
]

if (import.meta.main) {
    const options: BmfOptions = {
        excludeRefs: !!process.env.BENCH_EXCLUDE_REFS,
        excludeTiny: !!process.env.BENCH_EXCLUDE_TINY,
        normalize: !!process.env.BENCH_NORMALIZE,
    }
    for (const lane of lanes) {
        const results = readBenchResults(lane.ndjson)
        if (results.length === 0) {
            console.warn(`No results in ${lane.ndjson} — skipping ${lane.out}`)
            continue
        }
        const pairedBase = lane.pairedBase
            ? readBenchResults(lane.pairedBase)
            : undefined
        if (pairedBase && pairedBase.length === 0) {
            throw new Error(`No paired base results in ${lane.pairedBase}`)
        }
        const bmf = pairedBase
            ? toPairedBmf(pairedBase, results, options)
            : toBmf(results, options)
        writeFileSync(lane.out, JSON.stringify(bmf, null, 2))
        const normalized = options.normalize
            ? ` with ${NORMALIZED_LATENCY_MEASURE}`
            : ""
        console.log(
            `Wrote ${Object.keys(bmf).length} benchmarks${normalized} -> ${lane.out}`,
        )
    }
}
