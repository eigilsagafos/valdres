import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { toBenchmarkObservation } from "../../packages/valdres/test/performance/bench-utils"
import { readBenchResults } from "./read-bench-results"

const tempDirs: string[] = []

afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
        rmSync(dir, { recursive: true, force: true })
    }
})

function writeRows(...rows: unknown[]): string {
    const dir = mkdtempSync(join(tmpdir(), "valdres-bench-results-"))
    tempDirs.push(dir)
    const path = join(dir, "results.ndjson")
    writeFileSync(
        path,
        rows
            .map(row => (typeof row === "string" ? row : JSON.stringify(row)))
            .join("\n"),
    )
    return path
}

describe("readBenchResults", () => {
    test("round-trips the compact row produced from Mitata stats", () => {
        const observation = toBenchmarkObservation("example", {
            p25: 80,
            p50: 100,
            p75: 120,
            p99: 150,
            ticks: 12,
            samples: [80, 100, 120],
        })

        const [result] = readBenchResults(writeRows(observation))

        expect(result).toEqual(observation)
        expect("samples" in result).toBe(false)
        expect(result).toMatchObject({ sampleCount: 3, ticks: 12 })
    })

    test("preserves legacy unversioned observations", () => {
        const legacy = { kind: "latency", name: "example", ns: 100 } as const

        expect(readBenchResults(writeRows(legacy))).toEqual([legacy])
    })

    test("reports invalid JSON with its line number", () => {
        const path = writeRows(
            { kind: "latency", name: "example", ns: 100 },
            "not json",
        )

        expect(() => readBenchResults(path)).toThrow(`${path}:2: invalid JSON`)
    })

    test("rejects mixed legacy and versioned files explicitly", () => {
        const legacy = { kind: "latency", name: "example", ns: 100 } as const
        const current = toBenchmarkObservation("example", {
            p25: 80,
            p50: 100,
            p75: 120,
            p99: 150,
            ticks: 12,
            samples: [80, 100, 120],
        })
        const path = writeRows(legacy, current)

        expect(() => readBenchResults(path)).toThrow(
            `${path}: mixed benchmark schema versions`,
        )
    })
})
