/**
 * Reads bench-results.ndjson and generates:
 * 1. bench-results.json — for github-action-benchmark (GitHub Pages visualization)
 * 2. bench-history-entry.json — compact entry for our own benchmark-data branch
 */
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

const ROOT = join(import.meta.dir, "..")
const RESULTS_PATH = join(
    ROOT,
    "packages/valdres/test/performance/bench-results.ndjson",
)
const GH_BENCH_PATH = join(ROOT, "bench-results.json")
const HISTORY_ENTRY_PATH = join(ROOT, "bench-history-entry.json")

interface Result {
    name: string
    valdres: number
    jotai: number
    ratio: number
    tag: string
    threshold?: number
    cv?: number
}

const ndjson = readFileSync(RESULTS_PATH, "utf-8").trim()
const results: Result[] = ndjson.split("\n").map(line => JSON.parse(line))

// 1. github-action-benchmark format (for GitHub Pages trend chart)
const ghBenchResults = results.map(r => ({
    name: r.name,
    unit: "ns",
    value: Math.round(r.valdres),
    extra:
        r.tag === "baseline"
            ? "baseline"
            : `jotai=${Math.round(r.jotai)} ratio=${r.ratio.toFixed(4)} ${r.tag}`,
}))

writeFileSync(GH_BENCH_PATH, JSON.stringify(ghBenchResults, null, 2))
console.log("bench-results.json generated for github-action-benchmark")

// 2. Compact history entry (for benchmark-data branch)
const historyEntry = {
    date: new Date().toISOString(),
    benchmarks: results
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
