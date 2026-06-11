/**
 * Regenerates docs/content/bench-summary.json from Bencher's PUBLIC API (no token).
 *
 * The docs landing page reads this file at build time for its headline speedup
 * numbers (JSC/Safari + V8/Chrome geomeans) and the per-category breakdown. This
 * is the docs counterpart to gen-bench-table.ts (which refreshes the README) and
 * runs from the same .github/workflows/bench-table.yml after the "Bencher (base)"
 * lane uploads new `main` numbers.
 *
 *   bun run scripts/gen-bench-summary.ts
 *
 * Methodology: for every operation benchmarked head-to-head against Jotai, the
 * speedup is jotai_latency / valdres_latency. The headline averages are the
 * geometric mean of those per-op speedups, per engine — every comparison
 * benchmark counts, none are excluded.
 */
import { existsSync, readFileSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { TESTBEDS, latestLatencies, pairByOp } from "./lib/bencher"

const ROOT = join(import.meta.dir, "..")
const OUT = join(ROOT, "docs/content/bench-summary.json")

// The docs site (and this file's directory) only lives on the branch that
// carries the docs build. On branches without it — e.g. plain `main` before
// the docs land — skip cleanly so the shared bench-table workflow stays green.
if (!existsSync(dirname(OUT))) {
    console.log(`Skipping: ${dirname(OUT)} does not exist on this branch.`)
    process.exit(0)
}

// Category order is fixed; an op is filed under the first pattern it matches.
const CATEGORIES: [string, RegExp][] = [
    ["Atoms", /^(atom(?!Family)|store\.get|set\(atom|set \d+ atoms|get \d+ atoms)/],
    ["Selectors", /^(selector(?!Family)|set \+ read|chained)/],
    ["Transactions", /^txn:/],
    ["Store", /^(createStore|sub\s*\+\s*unsub)/],
    ["Families", /^(atomFamily|selectorFamily)/],
]

function categorize(name: string): string {
    for (const [cat, pattern] of CATEGORIES) if (pattern.test(name)) return cat
    return "Other"
}

function tag(valdres: number, jotai: number): string {
    const ratio = jotai / valdres
    return ratio >= 1
        ? `${ratio.toFixed(1)}x faster`
        : `${(1 / ratio).toFixed(1)}x slower`
}

function geometricMean(values: number[]): number {
    if (values.length === 0) return 0
    const logSum = values.reduce((acc, v) => acc + Math.log(v), 0)
    return Math.round(Math.exp(logSum / values.length) * 10) / 10
}

// Read the Jotai version that was benchmarked from valdres's devDependencies.
function jotaiVersion(): string {
    try {
        const pkg = JSON.parse(
            readFileSync(join(ROOT, "packages/valdres/package.json"), "utf8"),
        )
        const v = pkg.devDependencies?.jotai ?? pkg.dependencies?.jotai
        return typeof v === "string" ? v.replace(/^[\^~]/, "") : "unknown"
    } catch {
        return "unknown"
    }
}

interface Entry {
    name: string
    jscTag: string | null
    v8Tag: string | null
}

const jscOps = pairByOp(await latestLatencies(TESTBEDS.jsc.slug))
const v8Ops = pairByOp(await latestLatencies(TESTBEDS.v8.slug))

// Comparison ops = those with both valdres + jotai on at least one engine.
const opNames = new Set<string>()
for (const [op, { valdres, jotai }] of [...jscOps, ...v8Ops])
    if (valdres != null && jotai != null) opNames.add(op)

const jscSpeedups: number[] = []
const v8Speedups: number[] = []
const byCategory = new Map<string, Entry[]>()

for (const op of [...opNames].sort((a, b) => a.localeCompare(b))) {
    const jsc = jscOps.get(op)
    const v8 = v8Ops.get(op)
    const jscPaired = jsc?.valdres != null && jsc?.jotai != null
    const v8Paired = v8?.valdres != null && v8?.jotai != null
    if (jscPaired) jscSpeedups.push(jsc!.jotai! / jsc!.valdres!)
    if (v8Paired) v8Speedups.push(v8!.jotai! / v8!.valdres!)
    const cat = categorize(op)
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push({
        name: op,
        jscTag: jscPaired ? tag(jsc!.valdres!, jsc!.jotai!) : null,
        v8Tag: v8Paired ? tag(v8!.valdres!, v8!.jotai!) : null,
    })
}

// Emit categories in fixed order, then any "Other".
const order = [...CATEGORIES.map(([c]) => c), "Other"]
const categories = order
    .filter(c => byCategory.has(c))
    .map(name => ({ name, benchmarks: byCategory.get(name)! }))

const summary = {
    jscAverage: jscSpeedups.length ? geometricMean(jscSpeedups) : null,
    v8Average: v8Speedups.length ? geometricMean(v8Speedups) : null,
    jotaiVersion: jotaiVersion(),
    date: new Date().toISOString().split("T")[0],
    categories,
    benchmarkCount: opNames.size,
}

writeFileSync(OUT, JSON.stringify(summary, null, 2) + "\n")
console.log(
    `bench-summary.json refreshed: ${summary.benchmarkCount} benchmarks, ` +
        `JSC ${summary.jscAverage}x / V8 ${summary.v8Average}x`,
)
