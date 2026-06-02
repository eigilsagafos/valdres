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

function toBmf(results: BenchResult[]): Bmf {
    const bmf: Bmf = {}
    for (const r of results) {
        if (bmf[r.name]) {
            // Each "<op> / <impl>" name should be produced by exactly one bench
            // file. A collision means two files emit the same name with
            // different values — warn so a silent first-wins drop can't hide
            // which reading is gated.
            console.warn(
                `bench-to-bmf: duplicate benchmark "${r.name}" — keeping first reading, ignoring the rest`,
            )
            continue
        }
        bmf[r.name] = { latency: { value: r.ns } }
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
