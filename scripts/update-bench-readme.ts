/**
 * Reads bench-results.ndjson and updates the benchmark table in README.md.
 */
import { readFileSync, writeFileSync } from "fs"
import { join } from "path"

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

// Read results
const ndjson = readFileSync(RESULTS_PATH, "utf-8").trim()
const results: Result[] = ndjson.split("\n").map(line => JSON.parse(line))

// Split results into comparisons and baselines
const comparisons = results.filter(r => r.tag !== "baseline")
const baselines = results.filter(r => r.tag === "baseline")

// Generate comparison table
const compRows = comparisons.map(r => {
    const indicator = speedIndicator(r.ratio)
    return `| ${r.name} | ${fmtNs(r.valdres)} | ${fmtNs(r.jotai)} | ${indicator} ${r.tag} |`
})

const compTable = `| Benchmark | valdres | jotai | Comparison |
|:----------|--------:|------:|-----------:|
${compRows.join("\n")}`

// Generate baseline table
const baseRows = baselines.map(r => `| ${r.name} | ${fmtNs(r.valdres)} |`)
const baseTable =
    baselines.length > 0
        ? `\n\n#### Baseline (raw JS)\n\n| Operation | Time |\n|:----------|-----:|\n${baseRows.join("\n")}`
        : ""

const table = compTable + baseTable

const now = new Date().toISOString().split("T")[0]
const section = `${START_MARKER}
### Performance vs Jotai

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
