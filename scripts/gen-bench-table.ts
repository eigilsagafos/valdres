/**
 * Regenerates the README benchmark table from Bencher's PUBLIC API (no token).
 *
 * Pulls the latest `main` report for each testbed, pairs each "<op> / valdres"
 * with its "<op> / jotai" sibling, computes the speedup, and rewrites the table
 * between the <!-- BENCH:START --> / <!-- BENCH:END --> markers in README.md.
 *
 *   bun run scripts/gen-bench-table.ts
 *
 * The live, always-current view is bencher.dev/perf/valdres; this table is a
 * committed snapshot refreshed by .github/workflows/bench-table.yml.
 */
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

const API = "https://api.bencher.dev/v0"
const PROJECT = "valdres"
const TESTBEDS = [
    { slug: "ubuntu-2204-bun", label: "Bun (JavaScriptCore)" },
    { slug: "ubuntu-2204-node", label: "Node.js (V8)" },
]
const README = join(import.meta.dir, "..", "README.md")
const START = "<!-- BENCH:START -->"
const END = "<!-- BENCH:END -->"

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    return `${(ns / 1_000_000).toFixed(2)}ms`
}

function speedup(valdres: number, jotai: number): string {
    const ratio = jotai / valdres
    return ratio >= 1
        ? `🟢 ${ratio.toFixed(1)}× faster`
        : `🔴 ${(1 / ratio).toFixed(1)}× slower`
}

// Latest `main` report for a testbed → { "<op> / <impl>": latency_ns }.
async function latestLatencies(testbed: string): Promise<Map<string, number>> {
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

// Pair "<op> / valdres" with "<op> / jotai" (ignores map floor + valdres-only benches).
function pairByOp(
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

async function renderTestbed(tb: {
    slug: string
    label: string
}): Promise<string> {
    const ops = pairByOp(await latestLatencies(tb.slug))
    const rows: string[] = []
    for (const [op, { valdres, jotai }] of [...ops].sort((a, b) =>
        a[0].localeCompare(b[0]),
    )) {
        if (valdres == null || jotai == null) continue
        rows.push(
            `| \`${op}\` | ${fmtNs(valdres)} | ${fmtNs(jotai)} | ${speedup(valdres, jotai)} |`,
        )
    }
    if (rows.length === 0) return `#### ${tb.label}\n\n_No data yet._`
    return [
        `#### ${tb.label}`,
        "",
        "| Operation | valdres | Jotai | |",
        "|:----------|--------:|------:|:--|",
        ...rows,
    ].join("\n")
}

const sections = await Promise.all(TESTBEDS.map(renderTestbed))

const block = [
    START,
    "### Performance vs Jotai",
    "",
    "Latest `main` latency per operation (live, always-current numbers: [bencher.dev/perf/valdres](https://bencher.dev/perf/valdres)). Auto-generated from Bencher — do not hand-edit.",
    "",
    ...sections.flatMap(s => [s, ""]),
    END,
].join("\n")

const md = readFileSync(README, "utf8")
const i = md.indexOf(START)
const j = md.indexOf(END)
if (i === -1 || j === -1) {
    throw new Error(`README is missing ${START} / ${END} markers`)
}
writeFileSync(README, md.slice(0, i) + block + md.slice(j + END.length))
console.log(`README benchmark table refreshed (${sections.length} testbeds)`)
