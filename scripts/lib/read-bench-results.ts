import { readFileSync, existsSync } from "fs"

// One absolute latency (ns) reading for a benchmark (from measureOne / compare).
export interface LatencyResult {
    kind: "latency"
    name: string
    ns: number
}

export type BenchResult = LatencyResult

export function readBenchResults(path: string): BenchResult[] {
    if (!existsSync(path)) return []
    const ndjson = readFileSync(path, "utf-8").trim()
    if (!ndjson) return []
    return ndjson.split("\n").map(line => JSON.parse(line))
}
