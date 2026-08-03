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
import {
    BENCHMARK_RESULT_SCHEMA_VERSION,
    benchmarkName,
    benchmarkP50,
    type BenchmarkObservation,
    type BenchResult,
    readBenchResults,
} from "./lib/read-bench-results"
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
        const name = benchmarkName(result)
        const value = benchmarkP50(result)
        if (!Number.isFinite(value) || value <= 0) {
            throw new Error(`Latency for ${name} must be finite and positive`)
        }
        const values = samples.get(name)
        if (values) values.push(value)
        else samples.set(name, [value])
    }
    return samples
}

function pairedObservationKey(result: BenchmarkObservation): string {
    return JSON.stringify([result.benchmark, result.pairId])
}

function processBlockSignature(
    observations: BenchmarkObservation[],
    side: "base" | "head",
): string[] {
    const byRun = new Map<string, string[]>()
    for (const observation of observations) {
        if (observation.side !== side) continue
        const names = byRun.get(observation.runId)
        if (names) names.push(observation.benchmark)
        else byRun.set(observation.runId, [observation.benchmark])
    }
    return [...byRun.values()].map(names => names.sort().join("\u0000")).sort()
}

function sameStrings(left: string[], right: string[]): boolean {
    return (
        left.length === right.length &&
        left.every((value, index) => value === right[index])
    )
}

/** Validate the identity protocol before using any paired measurements. */
function validatePairedObservations(
    resultSets: BenchResult[][],
): BenchmarkObservation[] {
    const results = resultSets.flat()
    if (
        results.some(
            result =>
                !("schemaVersion" in result) ||
                result.schemaVersion !== BENCHMARK_RESULT_SCHEMA_VERSION,
        )
    ) {
        throw new Error(
            `Paired benchmark conversion requires schemaVersion ${BENCHMARK_RESULT_SCHEMA_VERSION} observations; rerun both sides with the current benchmark harness`,
        )
    }
    const observations = results as BenchmarkObservation[]
    if (observations.length === 0) {
        throw new Error("Paired benchmark conversion requires observations")
    }

    const seenSides = new Set<string>()
    const pairIdsByBenchmark = new Map<
        string,
        { base: Set<string>; head: Set<string> }
    >()
    const runIdentity = new Map<string, string>()
    const byPairId = new Map<string, BenchmarkObservation[]>()

    for (const observation of observations) {
        const pairKey = pairedObservationKey(observation)
        const sideKey = JSON.stringify([pairKey, observation.side])
        if (seenSides.has(sideKey)) {
            throw new Error(
                `Duplicate ${observation.side} observation for ${observation.benchmark} in pair ${observation.pairId}`,
            )
        }
        seenSides.add(sideKey)

        let pairIds = pairIdsByBenchmark.get(observation.benchmark)
        if (!pairIds) {
            pairIds = { base: new Set(), head: new Set() }
            pairIdsByBenchmark.set(observation.benchmark, pairIds)
        }
        pairIds[observation.side].add(observation.pairId)

        // Every observation from one process block intentionally shares a
        // runId. Reuse is invalid only when it points at a different process or
        // execution identity.
        const identity = JSON.stringify([
            observation.pairId,
            observation.side,
            observation.order,
            observation.runtime,
            observation.suite,
            observation.processId,
        ])
        const existingIdentity = runIdentity.get(observation.runId)
        if (existingIdentity !== undefined && existingIdentity !== identity) {
            throw new Error(
                `Duplicate run identity ${observation.runId} has inconsistent metadata`,
            )
        }
        runIdentity.set(observation.runId, identity)

        const pair = byPairId.get(observation.pairId)
        if (pair) pair.push(observation)
        else byPairId.set(observation.pairId, [observation])
    }

    for (const [benchmark, pairIds] of pairIdsByBenchmark) {
        const base = [...pairIds.base].sort()
        const head = [...pairIds.head].sort()
        if (base.length > 0 && head.length > 0 && !sameStrings(base, head)) {
            throw new Error(
                `Mismatched pair IDs for ${benchmark}: base=${base.join(",")}; head=${head.join(",")}`,
            )
        }
        for (const pairId of new Set([...base, ...head])) {
            if (!pairIds.base.has(pairId)) {
                throw new Error(
                    `Missing base side for ${benchmark} in pair ${pairId}`,
                )
            }
            if (!pairIds.head.has(pairId)) {
                throw new Error(
                    `Missing head side for ${benchmark} in pair ${pairId}`,
                )
            }
        }
    }

    for (const [pairId, pair] of byPairId) {
        const runtimes = new Set(pair.map(result => result.runtime))
        const suites = new Set(pair.map(result => result.suite))
        if (runtimes.size !== 1 || suites.size !== 1) {
            throw new Error(
                `Inconsistent runtime/suite metadata for pair ${pairId}`,
            )
        }

        const baseOrders = new Set(
            pair
                .filter(result => result.side === "base")
                .map(result => result.order),
        )
        const headOrders = new Set(
            pair
                .filter(result => result.side === "head")
                .map(result => result.order),
        )
        if (
            baseOrders.size !== 1 ||
            headOrders.size !== 1 ||
            !sameStrings([...baseOrders, ...headOrders].sort().map(String), [
                "1",
                "2",
            ])
        ) {
            throw new Error(
                `Invalid execution order metadata for pair ${pairId}`,
            )
        }

        const baseBlocks = processBlockSignature(pair, "base")
        const headBlocks = processBlockSignature(pair, "head")
        if (!sameStrings(baseBlocks, headBlocks)) {
            throw new Error(`Incomplete process blocks for pair ${pairId}`)
        }
    }

    return observations
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
 * base median by the paired head/base ratio makes that comparison evaluate the
 * paired statistic directly. Taking independent base and head medians first can
 * manufacture a regression when an order or runner effect moves both
 * measurements in only one pair.
 *
 * The ratio across pairs is combined with `min` — see the comment at the call
 * site for why the one-directional nature of runner interference makes that the
 * robust choice.
 */
export function toPairedBmf(
    baseResults: BenchResult[],
    headResults: BenchResult[],
    options: BmfOptions = {},
): Bmf {
    if (options.normalize) {
        throw new Error("Paired BMF does not support runner normalization")
    }

    // Side identity comes from each observation, not from which file or line it
    // occupied. The two arrays may therefore be shuffled or even swapped.
    const observations = validatePairedObservations([baseResults, headResults])
    const explicitBase = observations.filter(result => result.side === "base")
    const explicitHead = observations.filter(result => result.side === "head")
    const baseBmf = toBmf(explicitBase, options)
    const headBmf = toBmf(explicitHead, options)
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

    const pairs = new Map<
        string,
        { base?: BenchmarkObservation; head?: BenchmarkObservation }
    >()
    for (const observation of observations) {
        const key = pairedObservationKey(observation)
        const pair = pairs.get(key) ?? {}
        pair[observation.side] = observation
        pairs.set(key, pair)
    }
    const paired: Bmf = {}
    for (const name of baseNames) {
        const benchmarkPairs = [...pairs.values()].filter(
            pair => pair.base?.benchmark === name,
        ) as Array<{
            base: BenchmarkObservation
            head: BenchmarkObservation
        }>

        // MINIMUM, not median, of the paired ratios. Runner interference is
        // one-directional: a stall, a noisy neighbour, or an unlucky JIT tier
        // makes a sample SLOWER and never faster. So every contaminated pair
        // pushes its ratio up, and the smallest ratio is the least contaminated
        // estimate of the true one. Median only survives one bad pair out of
        // three; sub-microsecond benchmarks routinely lost two (observed: a
        // single CI job measuring `set(atom, value)` at 131ns, 351ns, 131ns,
        // and a whole sample window running +34% with 20 of 59 benchmarks more
        // than 50% slow), which is what made this gate flake on unrelated PRs.
        //
        // This costs nothing in sensitivity at the boundary this gate uses: a
        // genuine >50% same-runner regression is present in EVERY pair, so its
        // minimum ratio is still over the line. What it gives up is the ability
        // to detect a regression smaller than the runner's own noise — which
        // this gate never claimed to have.
        const pairedRatio = Math.min(
            ...benchmarkPairs.map(pair => pair.head.p50 / pair.base.p50),
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
// gate can run this PR-checkout converter against both worktrees' versioned
// observations.
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
