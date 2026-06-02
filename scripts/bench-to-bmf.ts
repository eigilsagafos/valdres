/**
 * Converts the benchmark NDJSON produced by the measurement layer
 * (packages/valdres/test/performance/bench-utils.ts) into Bencher Metric
 * Format (BMF) JSON — one file per runtime, uploaded to its own Bencher testbed.
 *
 *   bench-results.ndjson       -> packages/valdres/bun_results.json   (testbed: ubuntu-latest-bun)
 *   bench-results-node.ndjson  -> packages/valdres/node_results.json  (testbed: ubuntu-latest-node)
 *
 * Each head-to-head benchmark emits three measures:
 *   - ratio           valdres_ns / jotai_ns  — the GATE metric (lower = valdres faster);
 *                     runner noise that hits both libs cancels in the quotient.
 *   - valdres-latency ns — informational (powers the website plot / debugging)
 *   - jotai-latency   ns — informational
 * Single-side baseline entries (measureOne) emit only valdres-latency.
 *
 * Bencher gates on Thresholds configured in CI (on the `ratio` measure), NOT on
 * the values here; lower_value/upper_value are display-only spread for the plots.
 */
import { writeFileSync } from "fs"
import { join } from "path"
import { readBenchResults } from "./lib/read-bench-results"

// bench-utils writes extra fields beyond the typed BenchResult; surface them.
interface RichResult {
    name: string
    valdres: number
    jotai: number
    ratio: number
    tag: string
    cv?: number
    pairRatioP10?: number
    pairRatioP90?: number
}

type Metric = { value: number; lower_value?: number; upper_value?: number }
type Bmf = Record<string, Record<string, Metric>>

const ROOT = join(import.meta.dir, "..")
const PERF_DIR = join(ROOT, "packages/valdres/test/performance")

// A symmetric ±CV band around a value, for the plot's confidence interval.
function band(value: number, cv: number | undefined): Partial<Metric> {
    if (!cv || cv <= 0) return {}
    return { lower_value: value * (1 - cv), upper_value: value * (1 + cv) }
}

function toBmf(results: RichResult[]): Bmf {
    const bmf: Bmf = {}
    for (const r of results) {
        const isBaseline = r.tag === "baseline" || !r.jotai
        if (isBaseline) {
            // Single-side reference points (measureOne): raw Map/object yardsticks
            // and valdres/jotai measured in isolation. Tracked under a neutral
            // `latency` measure — so they overlay on one plot and aren't mislabeled
            // as valdres (measureOne stores its one value in the `valdres` field
            // regardless of what it measures). Not gated; visible trend only.
            bmf[r.name] = {
                latency: { value: r.valdres, ...band(r.valdres, r.cv) },
            }
        } else {
            // Head-to-head (assertFaster): the gated `ratio` plus both absolute sides.
            bmf[r.name] = {
                ratio: {
                    value: r.ratio,
                    // p10/p90 of the paired ratios when present — a real measured band.
                    lower_value: r.pairRatioP10,
                    upper_value: r.pairRatioP90,
                },
                "valdres-latency": { value: r.valdres, ...band(r.valdres, r.cv) },
                "jotai-latency": { value: r.jotai, ...band(r.jotai, r.cv) },
            }
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
    const results = readBenchResults(lane.ndjson) as unknown as RichResult[]
    if (results.length === 0) {
        console.warn(`No results in ${lane.ndjson} — skipping ${lane.out}`)
        continue
    }
    const bmf = toBmf(results)
    writeFileSync(lane.out, JSON.stringify(bmf, null, 2))
    console.log(`Wrote ${Object.keys(bmf).length} benchmarks -> ${lane.out}`)
}
