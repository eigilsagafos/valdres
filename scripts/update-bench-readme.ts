/**
 * Reads bench-results.ndjson and updates the benchmark table in README.md.
 */
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"
import { groupByCategory } from "./lib/bench-categories"

const ROOT = join(import.meta.dir, "..")
const RESULTS_PATH = join(
    ROOT,
    "packages/valdres/test/performance/bench-results.ndjson",
)
const README_PATH = join(ROOT, "README.md")

const START_MARKER = "<!-- BENCH:START -->"
const END_MARKER = "<!-- BENCH:END -->"

interface Result {
    name: string
    valdres: number
    jotai: number
    ratio: number
    tag: string
    threshold?: number
}

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

// Read Jotai version (check workspace-local node_modules first, then root)
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
const ndjson = readFileSync(RESULTS_PATH, "utf-8").trim()
const results: Result[] = ndjson.split("\n").map(line => JSON.parse(line))

// Split results into comparisons, optimization targets, and baselines
const OPTIMIZATION_TARGET_THRESHOLD = 10.0
const comparisons = results.filter(
    r => r.tag !== "baseline" && (r.threshold ?? 1.0) < OPTIMIZATION_TARGET_THRESHOLD,
)
const optimizationTargets = results.filter(
    r => r.tag !== "baseline" && (r.threshold ?? 1.0) >= OPTIMIZATION_TARGET_THRESHOLD,
)
const baselines = results.filter(r => r.tag === "baseline")

// Generate grouped comparison table (deterministic order from BENCH_CATEGORIES)
const grouped = groupByCategory(comparisons, r => r.name)

const compSections: string[] = []
for (const [cat, benchmarks] of grouped) {
    const rows = benchmarks.map(r => {
        const indicator = speedIndicator(r.ratio)
        return `| ${r.name} | ${fmtNs(r.valdres)} | ${fmtNs(r.jotai)} | ${indicator} ${r.tag} |`
    })
    compSections.push(
        `#### ${cat}\n\n| Benchmark | valdres | jotai | Comparison |\n|:----------|--------:|------:|-----------:|\n${rows.join("\n")}`,
    )
}
const compTable = compSections.join("\n\n")

// Generate optimization targets table (areas where we're already fast, tracking for improvement)
const optTable =
    optimizationTargets.length > 0
        ? `\n\n#### Not yet optimized\n\nThese operations are functional but not yet tuned for speed. Tracked for future improvement.\n\n| Benchmark | valdres | jotai | Comparison |\n|:----------|--------:|------:|-----------:|\n${optimizationTargets.map(r => {
              const indicator = speedIndicator(r.ratio)
              return `| ${r.name} | ${fmtNs(r.valdres)} | ${fmtNs(r.jotai)} | ${indicator} ${r.tag} |`
          }).join("\n")}`
        : ""

// Generate baseline table
const baseRows = baselines.map(r => `| ${r.name} | ${fmtNs(r.valdres)} |`)
const baseTable =
    baselines.length > 0
        ? `\n\n<details>\n<summary>Baseline (raw JS operations for reference)</summary>\n\n| Operation | Time |\n|:----------|-----:|\n${baseRows.join("\n")}\n\n</details>`
        : ""

const table = compTable + optTable + baseTable

const now = new Date().toISOString().split("T")[0]
const section = `${START_MARKER}
### Performance vs Jotai

All benchmarks compare valdres against [Jotai](https://github.com/pmndrs/jotai) v${jotaiVersion} on the same CI runner.

${table}

> Last updated: ${now} — [Historical trends](https://eigilsagafos.github.io/valdres/dev/bench/)
${END_MARKER}`

// Update README
const readme = readFileSync(README_PATH, "utf-8")
const startIdx = readme.indexOf(START_MARKER)
const endIdx = readme.indexOf(END_MARKER)

let updated: string
if (startIdx !== -1 && endIdx !== -1) {
    updated =
        readme.slice(0, startIdx) +
        section +
        readme.slice(endIdx + END_MARKER.length)
} else {
    updated = readme.trimEnd() + "\n\n" + section + "\n"
}

writeFileSync(README_PATH, updated)
console.log("README.md updated with benchmark results")
