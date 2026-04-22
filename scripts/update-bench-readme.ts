/**
 * Reads bench-results.ndjson (Bun) and bench-results-node.ndjson (Node)
 * and updates:
 * 1. README.md — compact comparison table (JSC/Safari vs V8/Chrome)
 * 2. BENCHMARKS.md — full timing details for both runtimes
 */
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { groupByCategory } from "./lib/bench-categories"
import { type BenchResult, readBenchResults } from "./lib/read-bench-results"

const ROOT = join(import.meta.dir, "..")
const PERF_DIR = join(ROOT, "packages/valdres/test/performance")
const BUN_RESULTS_PATH = join(PERF_DIR, "bench-results.ndjson")
const NODE_RESULTS_PATH = join(PERF_DIR, "bench-results-node.ndjson")
const README_PATH = join(ROOT, "README.md")
const BENCHMARKS_PATH = join(ROOT, "BENCHMARKS.md")

const START_MARKER = "<!-- BENCH:START -->"
const END_MARKER = "<!-- BENCH:END -->"

const JSC_LABEL = "JSC (Safari)"
const V8_LABEL = "V8 (Chrome)"

const OPTIMIZATION_TARGET_THRESHOLD = 10.0

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    return `${(ns / 1_000_000).toFixed(2)}ms`
}

function speedIndicator(ratio: number): string {
    if (ratio <= 1.0) return "🟢"
    if (ratio <= 2.0) return "🟡"
    return "🔴"
}

function fmtTag(r: BenchResult): string {
    return `${speedIndicator(r.ratio)} ${r.tag}`
}

// Read Jotai version
let jotaiVersion = "unknown"
for (const path of [
    join(ROOT, "packages/valdres/node_modules/jotai/package.json"),
    join(ROOT, "node_modules/jotai/package.json"),
]) {
    try {
        const jotaiPkg = JSON.parse(readFileSync(path, "utf-8"))
        jotaiVersion = jotaiPkg.version
        break
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue
        throw error
    }
}

// Read results
const bunResults = readBenchResults(BUN_RESULTS_PATH)
const nodeResults = readBenchResults(NODE_RESULTS_PATH)
const hasNode = nodeResults.length > 0
const hasBun = bunResults.length > 0

if (!hasBun && !hasNode) {
    console.error("No benchmark results found")
    process.exit(1)
}

const nodeByName = new Map(nodeResults.map(r => [r.name, r]))
const primaryResults = hasBun ? bunResults : nodeResults

const comparisons = primaryResults.filter(
    r => r.tag !== "baseline" && (r.threshold ?? 1.0) < OPTIMIZATION_TARGET_THRESHOLD,
)
const optimizationTargets = primaryResults.filter(
    r => r.tag !== "baseline" && (r.threshold ?? 1.0) >= OPTIMIZATION_TARGET_THRESHOLD,
)

const now = new Date().toISOString().split("T")[0]
const dual = hasBun && hasNode

// ── README: compact table ────────────────────────────────────────────

function compactHeader(): string {
    if (dual) {
        return `| Benchmark | ${JSC_LABEL} | ${V8_LABEL} |\n|:----------|-----------:|-----------:|`
    }
    const label = hasBun ? JSC_LABEL : V8_LABEL
    return `| Benchmark | ${label} |\n|:----------|-----------:|`
}

function compactRow(r: BenchResult): string {
    const bunTag = fmtTag(r)
    if (dual) {
        const nodeR = nodeByName.get(r.name)
        const nodeTag = nodeR ? fmtTag(nodeR) : "—"
        return `| ${r.name} | ${bunTag} | ${nodeTag} |`
    }
    return `| ${r.name} | ${bunTag} |`
}

const grouped = groupByCategory(comparisons, r => r.name)
const header = compactHeader()

const compSections: string[] = []
for (const [cat, benchmarks] of grouped) {
    compSections.push(`#### ${cat}\n\n${header}\n${benchmarks.map(compactRow).join("\n")}`)
}
const compTable = compSections.join("\n\n")

const optTable =
    optimizationTargets.length > 0
        ? `\n\n#### Not yet optimized\n\nThese operations are functional but not yet tuned for speed. Tracked for future improvement.\n\n${header}\n${optimizationTargets.map(compactRow).join("\n")}`
        : ""

const runtimeNote = dual
    ? "Bun (JavaScriptCore / Safari) and Node.js (V8 / Chrome)"
    : hasBun
      ? "Bun (JavaScriptCore / Safari)"
      : "Node.js (V8 / Chrome)"

const readmeSection = `${START_MARKER}
### Performance vs Jotai

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v${jotaiVersion} on the same CI runner using ${runtimeNote}.

${compTable}${optTable}

> [Full timing details](./BENCHMARKS.md) — Last updated: ${now} — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
${END_MARKER}`

const readme = readFileSync(README_PATH, "utf-8")
const startIdx = readme.indexOf(START_MARKER)
const endIdx = readme.indexOf(END_MARKER)

let updated: string
if (startIdx !== -1 && endIdx !== -1) {
    updated =
        readme.slice(0, startIdx) +
        readmeSection +
        readme.slice(endIdx + END_MARKER.length)
} else {
    updated = readme.trimEnd() + "\n\n" + readmeSection + "\n"
}

writeFileSync(README_PATH, updated)
console.log("README.md updated with benchmark results")

// ── BENCHMARKS.md: full detail ───────────────────────────────────────

function detailHeader(label: string): string {
    return `| Benchmark | valdres | jotai | ${label} |\n|:----------|--------:|------:|-----------:|`
}

function detailRow(r: BenchResult): string {
    return `| ${r.name} | ${fmtNs(r.valdres)} | ${fmtNs(r.jotai)} | ${fmtTag(r)} |`
}

function buildDetailSection(results: BenchResult[], label: string): string {
    const comps = results.filter(
        r => r.tag !== "baseline" && (r.threshold ?? 1.0) < OPTIMIZATION_TARGET_THRESHOLD,
    )
    const opts = results.filter(
        r => r.tag !== "baseline" && (r.threshold ?? 1.0) >= OPTIMIZATION_TARGET_THRESHOLD,
    )
    const bases = results.filter(r => r.tag === "baseline")

    const grouped = groupByCategory(comps, r => r.name)
    const hdr = detailHeader(label)

    const sections: string[] = []
    for (const [cat, benchmarks] of grouped) {
        sections.push(`#### ${cat}\n\n${hdr}\n${benchmarks.map(detailRow).join("\n")}`)
    }

    if (opts.length > 0) {
        sections.push(
            `#### Not yet optimized\n\n${hdr}\n${opts.map(detailRow).join("\n")}`,
        )
    }

    if (bases.length > 0) {
        const baseHdr = `| Operation | Time |\n|:----------|-----:|`
        const baseRows = bases.map(r => `| ${r.name} | ${fmtNs(r.valdres)} |`)
        sections.push(`#### Baseline\n\nRaw JS operations for reference.\n\n${baseHdr}\n${baseRows.join("\n")}`)
    }

    return sections.join("\n\n")
}

const detailLines: string[] = [
    "# Benchmark Details",
    "",
    `All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v${jotaiVersion}.`,
    "",
    `> Last updated: ${now}`,
    "",
]

if (hasBun) {
    detailLines.push(`### Bun — ${JSC_LABEL}`, "")
    detailLines.push(buildDetailSection(bunResults, JSC_LABEL))
    detailLines.push("")
}

if (hasNode) {
    detailLines.push(`### Node.js — ${V8_LABEL}`, "")
    detailLines.push(buildDetailSection(nodeResults, V8_LABEL))
    detailLines.push("")
}

writeFileSync(BENCHMARKS_PATH, detailLines.join("\n"))
console.log("BENCHMARKS.md updated with full timing details")

// ── docs/content/bench-summary.json ─────────────────────────────────

interface BenchSummaryEntry {
    name: string
    jscTag: string | null
    v8Tag: string | null
}

interface BenchSummaryCategory {
    name: string
    benchmarks: BenchSummaryEntry[]
}

function geometricMean(values: number[]): number {
    if (values.length === 0) return 0
    const logSum = values.reduce((acc, v) => acc + Math.log(v), 0)
    return Math.exp(logSum / values.length)
}

function computeAverage(results: BenchResult[]): number {
    const comps = results.filter(
        r => r.tag !== "baseline" && (r.threshold ?? 1.0) < OPTIMIZATION_TARGET_THRESHOLD,
    )
    // speedup = 1/ratio (ratio is valdres/jotai, so 1/ratio = jotai/valdres)
    const speedups = comps.map(r => 1 / r.ratio).filter(s => s > 0)
    return Math.round(geometricMean(speedups) * 10) / 10
}

const jscAverage = hasBun ? computeAverage(bunResults) : null
const v8Average = hasNode ? computeAverage(nodeResults) : null

// Build category breakdown for the detailed performance page
const categories: BenchSummaryCategory[] = []
for (const [cat, benchmarks] of grouped) {
    categories.push({
        name: cat,
        benchmarks: benchmarks.map(r => ({
            name: r.name,
            jscTag: hasBun ? r.tag : null,
            v8Tag: hasNode ? (nodeByName.get(r.name)?.tag ?? null) : null,
        })),
    })
}

const benchSummary = {
    jscAverage,
    v8Average,
    jotaiVersion,
    date: now,
    categories,
    benchmarkCount: comparisons.length,
}

const DOCS_BENCH_PATH = join(ROOT, "docs/content/bench-summary.json")
writeFileSync(DOCS_BENCH_PATH, JSON.stringify(benchSummary, null, 2))
console.log("docs/content/bench-summary.json updated")
