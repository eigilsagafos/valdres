/**
 * Reads bench-results.ndjson and generates bench-results.json
 * in the format expected by github-action-benchmark.
 */
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

const ROOT = join(import.meta.dir, "..")
const RESULTS_PATH = join(
    ROOT,
    "packages/valdres/test/performance/bench-results.ndjson",
)
const GH_BENCH_PATH = join(ROOT, "bench-results.json")

interface Result {
    name: string
    valdres: number
    jotai: number
    ratio: number
    tag: string
}

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    return `${(ns / 1_000_000).toFixed(2)}ms`
}

const ndjson = readFileSync(RESULTS_PATH, "utf-8").trim()
const results: Result[] = ndjson.split("\n").map(line => JSON.parse(line))

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
