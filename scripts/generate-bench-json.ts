/**
 * Reads bench-results.ndjson (Bun) and bench-results-node.ndjson (Node) and generates:
 * 1. bench-results.json — for github-action-benchmark (GitHub Pages visualization)
 * 2. bench-history-entry.json — compact entry for our own benchmark-data branch
 *
 * GitHub Pages results include a "[Bun]" / "[Node]" suffix so both runtimes
 * appear on the trend chart. History entries use the original names (bun-only)
 * to preserve backwards compatibility with the regression checker.
 */
import { writeFileSync } from "fs"
import { join } from "path"
import { type BenchResult, readBenchResults } from "./lib/read-bench-results"

const ROOT = join(import.meta.dir, "..")
const PERF_DIR = join(ROOT, "packages/valdres/test/performance")
const BUN_RESULTS_PATH = join(PERF_DIR, "bench-results.ndjson")
const NODE_RESULTS_PATH = join(PERF_DIR, "bench-results-node.ndjson")
const GH_BENCH_PATH = join(ROOT, "bench-results.json")
const HISTORY_ENTRY_PATH = join(ROOT, "bench-history-entry.json")

const bunResults = readBenchResults(BUN_RESULTS_PATH)
const nodeResults = readBenchResults(NODE_RESULTS_PATH)

if (bunResults.length === 0 && nodeResults.length === 0) {
    console.error("No benchmark results found")
    process.exit(1)
}

// 1. github-action-benchmark format (for GitHub Pages trend chart)
//    Bun names are always unsuffixed (stable baseline for chart continuity).
//    Node names get a " [Node]" suffix so they appear as separate series.
function toGhEntry(r: BenchResult, runtime: string) {
    const suffix = runtime === "node" ? " [Node]" : ""
    return {
        name: r.name + suffix,
        unit: "ns",
        value: Math.round(r.valdres),
        extra:
            r.tag === "baseline"
                ? "baseline"
                : `jotai=${Math.round(r.jotai)} ratio=${r.ratio.toFixed(4)} ${r.tag}`,
    }
}

const ghBenchResults = [
    ...bunResults.map(r => toGhEntry(r, "bun")),
    ...nodeResults.map(r => toGhEntry(r, "node")),
]

writeFileSync(GH_BENCH_PATH, JSON.stringify(ghBenchResults, null, 2))
console.log("bench-results.json generated for github-action-benchmark")

// 2. Compact history entry (for benchmark-data branch)
//    Uses Bun results only (primary runtime for regression detection).
//    Original names without runtime suffix for backwards compatibility.
const primaryResults = bunResults.length > 0 ? bunResults : nodeResults
const historyEntry = {
    date: new Date().toISOString(),
    benchmarks: primaryResults
        .filter(r => r.tag !== "baseline")
        .map(r => ({
            name: r.name,
            valdres: Math.round(r.valdres),
            jotai: Math.round(r.jotai),
            ratio: parseFloat(r.ratio.toFixed(4)),
            threshold: r.threshold ?? 1,
            cv: parseFloat((r.cv ?? 0).toFixed(4)),
        })),
}

writeFileSync(HISTORY_ENTRY_PATH, JSON.stringify(historyEntry, null, 2))
console.log("bench-history-entry.json generated for benchmark-data branch")
