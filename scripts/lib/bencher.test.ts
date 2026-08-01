import { afterEach, describe, expect, test } from "bun:test"
import {
    MIN_LATENCY_SERIES,
    MIN_PAIRED_OPS,
    latestLatencies,
    pairByOp,
    requirePairedOps,
} from "./bencher"

const TESTBED = "ubuntu-2204-bun"
const UUID = "019fba3c-8f56-73c0-b9a7-c4985e92896d"

// ---- fixtures ---------------------------------------------------------------

/** Latency measure entry in Bencher's report shape. */
function latencyMeasure(value: number) {
    return {
        measure: { slug: "latency", name: "Latency", units: "nanoseconds (ns)" },
        metric: { value, lower_value: null, upper_value: null },
    }
}

function resultItem(name: string, ns: number) {
    return { iteration: 0, benchmark: { name }, measures: [latencyMeasure(ns)] }
}

/**
 * A realistically sized detail report: 35 valdres/jotai pairs plus 15
 * valdres-only series = 85 latency series, above both acceptance floors.
 */
function fullDetailReport() {
    const items = []
    for (let i = 0; i < 35; i++) {
        items.push(resultItem(`op ${i} / valdres`, 100 + i))
        items.push(resultItem(`op ${i} / jotai`, 200 + i))
    }
    for (let i = 0; i < 15; i++) {
        items.push(resultItem(`standalone ${i}`, 50 + i))
    }
    return { uuid: UUID, adapter: "json", results: [items] }
}

/**
 * The current list-endpoint shape: report metadata with `counts` only —
 * NO embedded `results`. This is valid and must trigger the detail request.
 */
function listReport() {
    return {
        uuid: UUID,
        adapter: "json",
        counts: { results: [{ benchmarks: 85, measures: 1 }], alerts: {} },
    }
}

// ---- fetch mocking ----------------------------------------------------------

const realFetch = globalThis.fetch

afterEach(() => {
    globalThis.fetch = realFetch
})

/** Routes list/detail URLs to fixture bodies and records every request. */
function mockBencher(routes: {
    list?: unknown
    listStatus?: number
    detail?: unknown
    detailStatus?: number
}): string[] {
    const requested: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input)
        requested.push(url)
        if (url.includes("/reports?")) {
            return Response.json(routes.list ?? [listReport()], {
                status: routes.listStatus ?? 200,
            })
        }
        return Response.json(routes.detail ?? fullDetailReport(), {
            status: routes.detailStatus ?? 200,
        })
    }) as typeof fetch
    return requested
}

// ---- tests ------------------------------------------------------------------

describe("latestLatencies", () => {
    test("list without results is valid and triggers the detail request", async () => {
        const requested = mockBencher({})
        const latencies = await latestLatencies(TESTBED)

        expect(requested).toHaveLength(2)
        expect(requested[0]).toContain(
            `/reports?branch=main&testbed=${TESTBED}&per_page=1&direction=desc`,
        )
        expect(requested[1]).toContain(`/reports/${UUID}`)
        expect(latencies.size).toBe(85)
        expect(latencies.get("op 0 / valdres")).toBe(100)
        expect(latencies.get("op 0 / jotai")).toBe(200)
    })

    test("parsed latencies pair into enough valdres/jotai operations", async () => {
        mockBencher({})
        const ops = pairByOp(await latestLatencies(TESTBED))
        const fullyPaired = [...ops.values()].filter(
            op => op.valdres != null && op.jotai != null,
        )
        expect(fullyPaired.length).toBeGreaterThanOrEqual(MIN_PAIRED_OPS)
    })

    test("throws on a list-endpoint HTTP error", async () => {
        mockBencher({ list: {}, listStatus: 502 })
        await expect(latestLatencies(TESTBED)).rejects.toThrow("HTTP 502")
    })

    test("throws when the list has no reports", async () => {
        mockBencher({ list: [] })
        await expect(latestLatencies(TESTBED)).rejects.toThrow(
            "no reports on branch main",
        )
    })

    test("throws when the latest list report has no uuid", async () => {
        mockBencher({ list: [{ adapter: "json" }] })
        await expect(latestLatencies(TESTBED)).rejects.toThrow("no uuid")
    })

    test("throws on a detail-endpoint HTTP error", async () => {
        mockBencher({ detail: {}, detailStatus: 404 })
        await expect(latestLatencies(TESTBED)).rejects.toThrow("HTTP 404")
    })

    test("throws when the detail report has no results", async () => {
        const { results: _results, ...withoutResults } = fullDetailReport()
        mockBencher({ detail: withoutResults })
        await expect(latestLatencies(TESTBED)).rejects.toThrow(
            "missing or empty results",
        )
    })

    test("throws when the detail report's results are empty", async () => {
        mockBencher({ detail: { uuid: UUID, results: [] } })
        await expect(latestLatencies(TESTBED)).rejects.toThrow(
            "missing or empty results",
        )
    })

    test("throws on a malformed results arm", async () => {
        mockBencher({ detail: { uuid: UUID, results: ["not-an-arm"] } })
        await expect(latestLatencies(TESTBED)).rejects.toThrow(
            "malformed results arm",
        )
    })

    test("throws on a result item without a benchmark name", async () => {
        mockBencher({
            detail: { uuid: UUID, results: [[{ measures: [] }]] },
        })
        await expect(latestLatencies(TESTBED)).rejects.toThrow(
            "malformed result item",
        )
    })

    test("throws on a non-numeric latency value", async () => {
        const report = fullDetailReport()
        report.results[0][0].measures[0].metric.value =
            "fast" as unknown as number
        mockBencher({ detail: report })
        await expect(latestLatencies(TESTBED)).rejects.toThrow(
            'invalid latency for "op 0 / valdres"',
        )
    })

    test("throws on a zero latency value", async () => {
        // A zero would make a paired speedup Infinity, which JSON-serializes
        // to null and would republish the null averages this guards against.
        const report = fullDetailReport()
        report.results[0][0].measures[0].metric.value = 0
        mockBencher({ detail: report })
        await expect(latestLatencies(TESTBED)).rejects.toThrow(
            'invalid latency for "op 0 / valdres"',
        )
    })

    test("throws on a negative latency value", async () => {
        const report = fullDetailReport()
        report.results[0][0].measures[0].metric.value = -1
        mockBencher({ detail: report })
        await expect(latestLatencies(TESTBED)).rejects.toThrow(
            'invalid latency for "op 0 / valdres"',
        )
    })

    test("throws on a materially undersized report", async () => {
        const report = fullDetailReport()
        report.results = [report.results[0].slice(0, MIN_LATENCY_SERIES - 1)]
        mockBencher({ detail: report })
        await expect(latestLatencies(TESTBED)).rejects.toThrow(
            `need >= ${MIN_LATENCY_SERIES}`,
        )
    })
})

describe("requirePairedOps", () => {
    test("passes at the floor and throws below it", () => {
        expect(() => requirePairedOps(MIN_PAIRED_OPS, "ctx")).not.toThrow()
        expect(() => requirePairedOps(MIN_PAIRED_OPS - 1, "ctx")).toThrow(
            `need >= ${MIN_PAIRED_OPS}`,
        )
    })
})
