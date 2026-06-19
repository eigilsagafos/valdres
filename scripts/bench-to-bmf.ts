/**
 * Converts the benchmark NDJSON (from bench-utils.ts) into Bencher Metric
 * Format (BMF), one file per runtime/testbed. A SINGLE measure: the built-in
 * `latency` (nanoseconds — units are set automatically by Bencher).
 *
 * Each benchmark is one implementation of an operation, named "<op> / <impl>"
 * (e.g. "store.get(atom) / valdres", "store.get(atom) / jotai",
 * "store.get(atom) / map"). The competitor / native-floor comparison is read
 * off a Bencher plot by overlaying the sibling benchmarks; regression gating is
 * per-benchmark against the base branch. Names are deduped — an implementation
 * can be measured in more than one comparison (e.g. valdres.get appears in both
 * the vs-jotai and vs-map comparisons).
 *
 *   bench-results.ndjson       -> packages/valdres/bun_results.json   (testbed ubuntu-2204-bun)
 *   bench-results-node.ndjson  -> packages/valdres/node_results.json  (testbed ubuntu-2204-node)
 */
import { writeFileSync } from "fs"
import { join } from "path"
import { type BenchResult, readBenchResults } from "./lib/read-bench-results"

type Metric = { value: number; lower_value?: number; upper_value?: number }
type Bmf = Record<string, Record<string, Metric>>

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

// Operations too small to GATE reliably. These are sub-~10ns ops where the gate's
// +50% relative boundary is only a few nanoseconds — below the CI runner's
// measurement noise even after min-of-3 — so the percentage gate flips on
// variance rather than regressions (it has alerted on these while they measured
// FASTER than base). BENCH_EXCLUDE_TINY (set by the PR gate only) drops them from
// the gated comparison. They are still measured and plotted via the base lane
// (bencher-base.yml), so the historical perf page is unaffected — they're tracked,
// just not blocking. A new benchmark is gated by default; add it here only if it
// proves noise-dominated. Keep this in sync with the README's tiny ops.
const UNGATEABLE_OPS = new Set([
    "atom(1)", // ~2ns
    "selector(fn)", // ~5ns
    "atomFamily(id) cache hit", // ~10ns
])

function toBmf(results: BenchResult[]): Bmf {
    // The relative-CB gate runs the suite multiple times and concatenates the
    // NDJSON, so a benchmark name legitimately appears once per repeat. Keep the
    // MIN latency across repeats: interference (GC, scheduler, contention) only
    // ever adds time, so the minimum is the cleanest, most reproducible reading.
    // (A single run — e.g. the base lane — simply yields min-of-one.)
    //
    // BENCH_EXCLUDE_REFS drops the competitor/native-floor sides. The PR gate
    // sets it because those benches can't regress from a valdres change (jotai
    // is pinned, map is native) — gating them only adds noise. They're still
    // measured and plotted via the base lane (bencher-base.yml) for the
    // head-to-head perf page.
    const excludeRefs = !!process.env.BENCH_EXCLUDE_REFS
    const excludeTiny = !!process.env.BENCH_EXCLUDE_TINY
    const bmf: Bmf = {}
    for (const r of results) {
        if (excludeRefs && isReference(r.name)) continue
        if (excludeTiny && UNGATEABLE_OPS.has(opName(r.name))) continue
        const prev = bmf[r.name]?.latency.value
        if (prev === undefined || r.ns < prev) {
            bmf[r.name] = { latency: { value: r.ns } }
        }
    }
    return bmf
}

// Input NDJSON and output BMF paths are overridable via env so the relative-CB
// gate can run THIS (PR-checkout) script against the base worktree's results —
// the base SHA ships an older bench-to-bmf that would reject the repeated names.
const lanes = [
    {
        ndjson: process.env.BENCH_NDJSON_BUN ?? join(PERF_DIR, "bench-results.ndjson"),
        out: process.env.BENCH_OUT_BUN ?? join(ROOT, "packages/valdres/bun_results.json"),
    },
    {
        ndjson:
            process.env.BENCH_NDJSON_NODE ??
            join(PERF_DIR, "bench-results-node.ndjson"),
        out:
            process.env.BENCH_OUT_NODE ??
            join(ROOT, "packages/valdres/node_results.json"),
    },
]

for (const lane of lanes) {
    const results = readBenchResults(lane.ndjson)
    if (results.length === 0) {
        console.warn(`No results in ${lane.ndjson} — skipping ${lane.out}`)
        continue
    }
    const bmf = toBmf(results)
    writeFileSync(lane.out, JSON.stringify(bmf, null, 2))
    console.log(`Wrote ${Object.keys(bmf).length} benchmarks -> ${lane.out}`)
}
