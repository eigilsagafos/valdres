import { readFileSync, existsSync } from "fs"

export interface BenchResult {
    name: string
    valdres: number
    jotai: number
    ratio: number
    tag: string
    threshold?: number
    cv?: number
}

export function readBenchResults(path: string): BenchResult[] {
    if (!existsSync(path)) return []
    const ndjson = readFileSync(path, "utf-8").trim()
    if (!ndjson) return []
    return ndjson.split("\n").map(line => JSON.parse(line))
}
