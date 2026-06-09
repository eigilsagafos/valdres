/**
 * Read-only access to Bencher's PUBLIC API for the valdres project.
 *
 * Shared by the two committed-snapshot generators that run after the
 * "Bencher (base)" lane uploads new `main` numbers:
 *   - gen-bench-table.ts    → README.md comparison table
 *   - gen-bench-summary.ts  → docs/content/bench-summary.json
 *
 * Only reads public reports, so no token / Bencher.dev environment is needed.
 */
const API = "https://api.bencher.dev/v0"
const PROJECT = "valdres"

export const TESTBEDS = {
    jsc: { slug: "ubuntu-2204-bun", label: "Bun (JavaScriptCore)" },
    v8: { slug: "ubuntu-2204-node", label: "Node.js (V8)" },
} as const

/** Latest `main` report for a testbed → { "<op> / <impl>": latency_ns }. */
export async function latestLatencies(
    testbed: string,
): Promise<Map<string, number>> {
    const url = `${API}/projects/${PROJECT}/reports?branch=main&testbed=${testbed}&per_page=1&direction=desc`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Bencher reports (${testbed}): HTTP ${res.status}`)
    const reports = await res.json()
    const out = new Map<string, number>()
    if (!Array.isArray(reports) || reports.length === 0) return out
    for (const arm of reports[0].results ?? []) {
        for (const item of arm) {
            const lat = item.measures?.find(
                (m: { measure: { slug: string } }) => m.measure.slug === "latency",
            )
            if (lat) out.set(item.benchmark.name, lat.metric.value)
        }
    }
    return out
}

/** Pair "<op> / valdres" with "<op> / jotai" (drops map-floor + valdres-only). */
export function pairByOp(
    lat: Map<string, number>,
): Map<string, { valdres?: number; jotai?: number }> {
    const ops = new Map<string, { valdres?: number; jotai?: number }>()
    for (const [name, value] of lat) {
        const m = name.match(/^(.*) \/ (valdres|jotai)$/)
        if (!m) continue
        const entry = ops.get(m[1]) ?? {}
        entry[m[2] as "valdres" | "jotai"] = value
        ops.set(m[1], entry)
    }
    return ops
}
