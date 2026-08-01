/**
 * Read-only access to Bencher's PUBLIC API for the valdres project.
 *
 * Shared by the two committed-snapshot generators that run after the
 * "Bencher (base)" lane uploads new `main` numbers:
 *   - gen-bench-table.ts    → README.md comparison table
 *   - gen-bench-summary.ts  → docs/content/bench-summary.json
 *
 * Only reads public reports, so no token / Bencher.dev environment is needed.
 *
 * The reports LIST endpoint no longer embeds `results` (only `counts`), so the
 * latest report is resolved in two steps: read its UUID from the list, then
 * fetch the full report by UUID. Anything missing, malformed, or materially
 * undersized throws — the generators must fail loudly rather than silently
 * publish an empty "_No data yet._" snapshot over real numbers.
 */
const API = "https://api.bencher.dev/v0"
const PROJECT = "valdres"

export const TESTBEDS = {
    jsc: { slug: "ubuntu-2204-bun", label: "Bun (JavaScriptCore)" },
    v8: { slug: "ubuntu-2204-node", label: "Node.js (V8)" },
} as const

// Acceptance floors per testbed. A full base-lane upload currently carries
// ~103 latency series and ~34 valdres/jotai pairs; anything far below that is
// a partial or broken upload and must not overwrite the committed snapshots.
export const MIN_LATENCY_SERIES = 80
export const MIN_PAIRED_OPS = 30

async function fetchJson(url: string, what: string): Promise<unknown> {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Bencher ${what}: HTTP ${res.status}`)
    return res.json()
}

/** Latest `main` report for a testbed → { "<op> / <impl>": latency_ns }. */
export async function latestLatencies(
    testbed: string,
): Promise<Map<string, number>> {
    const list = await fetchJson(
        `${API}/projects/${PROJECT}/reports?branch=main&testbed=${testbed}&per_page=1&direction=desc`,
        `reports list (${testbed})`,
    )
    if (!Array.isArray(list) || list.length === 0) {
        throw new Error(
            `Bencher reports list (${testbed}): no reports on branch main`,
        )
    }
    // A list item without `results` is expected — only `counts` is embedded.
    const uuid = (list[0] as { uuid?: unknown })?.uuid
    if (typeof uuid !== "string" || uuid.length === 0) {
        throw new Error(
            `Bencher reports list (${testbed}): latest report has no uuid`,
        )
    }

    const report = await fetchJson(
        `${API}/projects/${PROJECT}/reports/${uuid}`,
        `report ${uuid} (${testbed})`,
    )
    const results = (report as { results?: unknown })?.results
    if (!Array.isArray(results) || results.length === 0) {
        throw new Error(
            `Bencher report ${uuid} (${testbed}): missing or empty results`,
        )
    }

    const out = new Map<string, number>()
    for (const arm of results) {
        if (!Array.isArray(arm)) {
            throw new Error(
                `Bencher report ${uuid} (${testbed}): malformed results arm`,
            )
        }
        for (const item of arm) {
            const name = item?.benchmark?.name
            const measures = item?.measures
            if (typeof name !== "string" || !Array.isArray(measures)) {
                throw new Error(
                    `Bencher report ${uuid} (${testbed}): malformed result item`,
                )
            }
            const lat = measures.find(
                (m: { measure?: { slug?: string } }) =>
                    m?.measure?.slug === "latency",
            )
            if (!lat) continue
            const value = lat.metric?.value
            // Latencies must be strictly positive: a zero would turn a paired
            // speedup into Infinity, which JSON-serializes to null downstream.
            if (
                typeof value !== "number" ||
                !Number.isFinite(value) ||
                value <= 0
            ) {
                throw new Error(
                    `Bencher report ${uuid} (${testbed}): invalid latency for "${name}"`,
                )
            }
            out.set(name, value)
        }
    }
    if (out.size < MIN_LATENCY_SERIES) {
        throw new Error(
            `Bencher report ${uuid} (${testbed}): only ${out.size} latency series ` +
                `(need >= ${MIN_LATENCY_SERIES}) — refusing undersized upload`,
        )
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

/** Throws unless `count` fully-paired valdres/jotai ops meet the floor. */
export function requirePairedOps(count: number, context: string): void {
    if (count < MIN_PAIRED_OPS) {
        throw new Error(
            `${context}: only ${count} paired valdres/jotai operations ` +
                `(need >= ${MIN_PAIRED_OPS}) — refusing undersized snapshot`,
        )
    }
}
