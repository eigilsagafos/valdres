import { readFileSync, existsSync } from "fs"
import {
    BENCHMARK_RESULT_SCHEMA_VERSION,
    type BenchmarkObservation,
    parseBenchmarkObservation,
} from "../../packages/valdres/test/performance/benchmark-result-schema"

// Schema v1 was unversioned. It remains readable for unpaired historical/local
// conversion, but lacks the identity needed for safe paired conversion.
export interface LegacyLatencyResult {
    kind: "latency"
    name: string
    ns: number
}

export type BenchResult = LegacyLatencyResult | BenchmarkObservation

export function benchmarkName(result: BenchResult): string {
    return "benchmark" in result ? result.benchmark : result.name
}

export function benchmarkP50(result: BenchResult): number {
    return "p50" in result ? result.p50 : result.ns
}

function parseLegacyLatencyResult(
    value: Record<string, unknown>,
    source: string,
): LegacyLatencyResult {
    if (
        value.kind !== "latency" ||
        typeof value.name !== "string" ||
        value.name.length === 0 ||
        typeof value.ns !== "number" ||
        !Number.isFinite(value.ns) ||
        value.ns <= 0
    ) {
        throw new Error(`${source}: invalid legacy benchmark observation`)
    }
    return value as unknown as LegacyLatencyResult
}

export function readBenchResults(path: string): BenchResult[] {
    if (!existsSync(path)) return []
    const ndjson = readFileSync(path, "utf-8").trim()
    if (!ndjson) return []
    const results = ndjson.split("\n").map((line, index) => {
        const source = `${path}:${index + 1}`
        let value: unknown
        try {
            value = JSON.parse(line)
        } catch {
            throw new Error(`${source}: invalid JSON`)
        }
        if (
            typeof value !== "object" ||
            value === null ||
            Array.isArray(value)
        ) {
            throw new Error(
                `${source}: benchmark observation must be an object`,
            )
        }
        const record = value as Record<string, unknown>
        return record.schemaVersion === undefined
            ? parseLegacyLatencyResult(record, source)
            : parseBenchmarkObservation(record, source)
    })
    const legacyCount = results.filter(
        result => !("schemaVersion" in result),
    ).length
    if (legacyCount > 0 && legacyCount < results.length) {
        throw new Error(`${path}: mixed benchmark schema versions`)
    }
    return results
}

export { BENCHMARK_RESULT_SCHEMA_VERSION }
export type { BenchmarkObservation }
