/**
 * Converts the benchmark NDJSON (from bench-utils.ts) into Bencher Metric
 * Format (BMF), one file per runtime/testbed. Two measures only:
 *
 *   ratio    — valdres / reference (jotai or map). The GATED metric; lower =
 *              valdres faster. Runner noise that hits both sides cancels in the
 *              quotient, so this is stable enough to gate on shared CI runners.
 *   latency  — Bencher's BUILT-IN measure (nanoseconds; units are set
 *              automatically). Absolute per-implementation timings; tracked for
 *              trend, never gated (absolute ns on shared runners is noisy).
 *
 * `compare` results (assertFaster) -> one `ratio` benchmark
 *   ("<op> · valdres vs <ref>") plus a `latency` benchmark for each side
 *   ("<op> / valdres", "<op> / <ref>").
 * `latency` results (measureOne) -> a single `latency` benchmark ("<name>").
 * Latency benchmark names are deduped — an implementation (e.g. valdres.get)
 * is measured in several comparisons; the first reading wins.
 *
 *   bench-results.ndjson       -> packages/valdres/bun_results.json   (testbed ubuntu-latest-bun)
 *   bench-results-node.ndjson  -> packages/valdres/node_results.json  (testbed ubuntu-latest-node)
 */
import { writeFileSync } from "fs"
import { join } from "path"
import { type BenchResult, readBenchResults } from "./lib/read-bench-results"

type Metric = { value: number; lower_value?: number; upper_value?: number }
type Bmf = Record<string, Record<string, Metric>>

const ROOT = join(import.meta.dir, "..")
const PERF_DIR = join(ROOT, "packages/valdres/test/performance")

// A symmetric ±CV band around a value, for the plot's confidence interval.
function band(value: number, cv: number | undefined): Partial<Metric> {
    if (!cv || cv <= 0) return {}
    return { lower_value: value * (1 - cv), upper_value: value * (1 + cv) }
}

function toBmf(results: BenchResult[]): Bmf {
    const bmf: Bmf = {}

    // First non-empty reading for a given implementation wins (the same impl
    // is measured across several comparisons — readings are equivalent).
    const setLatency = (name: string, ns: number, cv?: number) => {
        if (bmf[name]?.latency) return
        bmf[name] = { latency: { value: ns, ...band(ns, cv) } }
    }

    for (const r of results) {
        if (r.kind === "compare") {
            bmf[`${r.op} · valdres vs ${r.ref}`] = {
                ratio: {
                    value: r.ratio,
                    lower_value: r.ratioP10,
                    upper_value: r.ratioP90,
                },
            }
            setLatency(`${r.op} / valdres`, r.valdresNs, r.cv)
            setLatency(`${r.op} / ${r.ref}`, r.refNs, r.cv)
        } else {
            setLatency(r.name, r.ns, r.cv)
        }
    }
    return bmf
}

const lanes = [
    {
        ndjson: join(PERF_DIR, "bench-results.ndjson"),
        out: join(ROOT, "packages/valdres/bun_results.json"),
    },
    {
        ndjson: join(PERF_DIR, "bench-results-node.ndjson"),
        out: join(ROOT, "packages/valdres/node_results.json"),
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
