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
import { TESTBEDS, latestLatencies, pairByOp } from "./lib/bencher"

const TABLE_TESTBEDS = [TESTBEDS.jsc, TESTBEDS.v8]
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

const sections = await Promise.all(TABLE_TESTBEDS.map(renderTestbed))

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
