export const BENCHMARK_RESULT_SCHEMA_VERSION = 2 as const

export type BenchmarkSide = "base" | "head"
export type BenchmarkRuntime = "bun" | "node"

/**
 * One compact benchmark observation. Percentiles are nanoseconds per operation.
 * Mitata's raw sample array is deliberately represented only by its length.
 */
export interface BenchmarkObservation {
    schemaVersion: typeof BENCHMARK_RESULT_SCHEMA_VERSION
    kind: "latency"
    unit: "ns"
    benchmark: string
    pairId: string
    side: BenchmarkSide
    order: number
    runtime: BenchmarkRuntime
    suite: string
    runId: string
    processId: number
    p25: number
    p50: number
    p75: number
    p99: number
    ticks: number
    sampleCount: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0
}

function isBoundedSingleLineString(
    value: unknown,
    maxLength: number,
): value is string {
    return (
        isNonEmptyString(value) &&
        value.length <= maxLength &&
        !/[\u0000-\u001f\u007f]/.test(value)
    )
}

function isPositiveFinite(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value > 0
}

function isPositiveInteger(value: unknown): value is number {
    return Number.isInteger(value) && (value as number) > 0
}

export function parseBenchmarkObservation(
    value: unknown,
    source: string,
): BenchmarkObservation {
    if (!isRecord(value)) {
        throw new Error(`${source}: benchmark observation must be an object`)
    }
    if (value.schemaVersion !== BENCHMARK_RESULT_SCHEMA_VERSION) {
        throw new Error(
            `${source}: unsupported benchmark schema version ${String(value.schemaVersion)}; expected ${BENCHMARK_RESULT_SCHEMA_VERSION}`,
        )
    }
    if (value.kind !== "latency" || value.unit !== "ns") {
        throw new Error(`${source}: expected a latency observation in ns`)
    }
    if (!isBoundedSingleLineString(value.benchmark, 512)) {
        throw new Error(
            `${source}: benchmark must be a bounded single-line string`,
        )
    }
    if (!isBoundedSingleLineString(value.pairId, 256)) {
        throw new Error(
            `${source}: pairId must be a bounded single-line string`,
        )
    }
    if (value.side !== "base" && value.side !== "head") {
        throw new Error(`${source}: side must be base or head`)
    }
    if (!isPositiveInteger(value.order)) {
        throw new Error(`${source}: order must be a positive integer`)
    }
    if (value.runtime !== "bun" && value.runtime !== "node") {
        throw new Error(`${source}: runtime must be bun or node`)
    }
    if (!isBoundedSingleLineString(value.suite, 64)) {
        throw new Error(`${source}: suite must be a bounded single-line string`)
    }
    if (!isBoundedSingleLineString(value.runId, 256)) {
        throw new Error(`${source}: runId must be a bounded single-line string`)
    }
    if (!isPositiveInteger(value.processId)) {
        throw new Error(`${source}: processId must be a positive integer`)
    }

    const { p25, p50, p75, p99 } = value
    if (!isPositiveFinite(p25)) {
        throw new Error(`${source}: p25 must be finite and positive`)
    }
    if (!isPositiveFinite(p50)) {
        throw new Error(`${source}: p50 must be finite and positive`)
    }
    if (!isPositiveFinite(p75)) {
        throw new Error(`${source}: p75 must be finite and positive`)
    }
    if (!isPositiveFinite(p99)) {
        throw new Error(`${source}: p99 must be finite and positive`)
    }
    if (!(p25 <= p50 && p50 <= p75 && p75 <= p99)) {
        throw new Error(`${source}: latency percentiles must be ordered`)
    }
    if (!isPositiveInteger(value.ticks)) {
        throw new Error(`${source}: ticks must be a positive integer`)
    }
    if (!isPositiveInteger(value.sampleCount)) {
        throw new Error(`${source}: sampleCount must be a positive integer`)
    }
    if (value.ticks < value.sampleCount) {
        throw new Error(`${source}: ticks cannot be smaller than sampleCount`)
    }
    if ("samples" in value) {
        throw new Error(`${source}: raw Mitata samples must not be serialized`)
    }

    return value as unknown as BenchmarkObservation
}
