import { readFileSync, existsSync } from "fs"

// A paired valdres-vs-reference comparison (assertFaster). `ref` names the
// reference implementation ("jotai", "map", ...). The `ratio` is the gated
// metric; ratioP10/P90 are the measured spread.
export interface CompareResult {
    kind: "compare"
    op: string
    ref: string
    valdresNs: number
    refNs: number
    ratio: number
    ratioP10?: number
    ratioP90?: number
    cv?: number
    threshold?: number
}

// A single-side absolute latency (measureOne).
export interface LatencyResult {
    kind: "latency"
    name: string
    ns: number
    cv?: number
}

export type BenchResult = CompareResult | LatencyResult

export function readBenchResults(path: string): BenchResult[] {
    if (!existsSync(path)) return []
    const ndjson = readFileSync(path, "utf-8").trim()
    if (!ndjson) return []
    return ndjson.split("\n").map(line => JSON.parse(line))
}
