/**
 * Custom benchmark regression checker.
 *
 * Reads bench-results.ndjson (which has both valdres and jotai timings),
 * compares valdres results against the median of the last N runs on gh-pages,
 * and posts a PR comment with a side-by-side comparison table.
 *
 * Uses scale-aware thresholds so sub-nanosecond noise doesn't trigger false
 * positives while real regressions on larger benchmarks are still caught.
 *
 * Exit code 1 if any regression is detected.
 */
import { readFileSync } from "fs"
import { join } from "path"

// ── Configuration ──────────────────────────────────────────────────────────

const WINDOW_SIZE = 10 // number of recent runs to take the median of
const MIN_ABSOLUTE_CHANGE_NS = 50 // ignore regressions smaller than this

interface ThresholdTier {
    maxMedianNs: number
    absoluteFloorNs: number
    /** Ratio threshold (e.g. 1.5 = 150%). Infinity means "skip entirely". */
    percentThreshold: number
}

const TIERS: ThresholdTier[] = [
    { maxMedianNs: 100, absoluteFloorNs: 50, percentThreshold: Infinity },
    { maxMedianNs: 1_000, absoluteFloorNs: 100, percentThreshold: 1.5 },
    { maxMedianNs: 100_000, absoluteFloorNs: 0, percentThreshold: 1.3 },
    { maxMedianNs: Infinity, absoluteFloorNs: 0, percentThreshold: 1.2 },
]

// ── Types ──────────────────────────────────────────────────────────────────

interface NdjsonResult {
    name: string
    valdres: number
    jotai: number
    ratio: number
    tag: string
}

interface HistoricalBench {
    name: string
    value: number
    unit: string
    extra?: string
}

interface HistoricalEntry {
    commit: { id: string }
    date: number
    benches: HistoricalBench[]
}

interface HistoricalData {
    entries: Record<string, HistoricalEntry[]>
}

type Status = "ok" | "skip" | "new" | "regression"

interface Comparison {
    name: string
    valdres: number
    jotai: number
    vsJotai: string
    median: number | null
    changePercent: number | null
    status: Status
    threshold: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    return `${(ns / 1_000_000).toFixed(2)}ms`
}

function fmtChange(ratio: number | null): string {
    if (ratio == null) return "—"
    const pct = (ratio - 1) * 100
    const sign = pct >= 0 ? "+" : ""
    return `${sign}${pct.toFixed(0)}%`
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2
}

function tierFor(medianNs: number): ThresholdTier {
    return TIERS.find(t => medianNs <= t.maxMedianNs)!
}

// ── Core logic ─────────────────────────────────────────────────────────────

const ROOT = join(import.meta.dir, "..")
const NDJSON_PATH = join(
    ROOT,
    "packages/valdres/test/performance/bench-results.ndjson",
)

function readCurrentResults(): NdjsonResult[] {
    const ndjson = readFileSync(NDJSON_PATH, "utf-8").trim()
    return ndjson.split("\n").map(line => JSON.parse(line))
}

async function readHistoricalData(): Promise<HistoricalData | null> {
    try {
        const proc = Bun.spawn(
            ["git", "show", "origin/gh-pages:dev/bench/data.js"],
            { stdout: "pipe", stderr: "pipe" },
        )
        const raw = await new Response(proc.stdout).text()
        const exitCode = await proc.exited
        if (exitCode !== 0) return null

        const json = raw
            .replace(/^window\.BENCHMARK_DATA\s*=\s*/, "")
            .replace(/;\s*$/, "")
        return JSON.parse(json)
    } catch {
        return null
    }
}

function computeMedians(
    entries: HistoricalEntry[],
    windowSize: number,
): Map<string, number> {
    const recent = entries.slice(-windowSize)
    const byName = new Map<string, number[]>()

    for (const entry of recent) {
        for (const bench of entry.benches) {
            if (!byName.has(bench.name)) byName.set(bench.name, [])
            byName.get(bench.name)!.push(bench.value)
        }
    }

    const medians = new Map<string, number>()
    for (const [name, values] of byName) {
        medians.set(name, median(values))
    }
    return medians
}

function compare(
    current: NdjsonResult[],
    medians: Map<string, number>,
): Comparison[] {
    // Skip baseline entries (plain JS ops)
    const benchmarks = current.filter(r => r.tag !== "baseline")

    return benchmarks.map(bench => {
        const med = medians.get(bench.name)

        // valdres vs jotai comparison
        const ratio = bench.jotai > 0 ? bench.valdres / bench.jotai : 1
        const vsJotai =
            ratio <= 1
                ? `${(1 / ratio).toFixed(1)}x faster`
                : `${ratio.toFixed(1)}x slower`

        if (med == null) {
            return {
                name: bench.name,
                valdres: bench.valdres,
                jotai: bench.jotai,
                vsJotai,
                median: null,
                changePercent: null,
                status: "new" as Status,
                threshold: null,
            }
        }

        const tier = tierFor(med)
        const absoluteChange = bench.valdres - med
        const changePercent = med > 0 ? bench.valdres / med : 1

        let status: Status
        if (tier.percentThreshold === Infinity) {
            status = "skip"
        } else if (
            changePercent > tier.percentThreshold &&
            absoluteChange > MIN_ABSOLUTE_CHANGE_NS &&
            absoluteChange > tier.absoluteFloorNs
        ) {
            status = "regression"
        } else {
            status = "ok"
        }

        return {
            name: bench.name,
            valdres: bench.valdres,
            jotai: bench.jotai,
            vsJotai,
            median: med,
            changePercent,
            status,
            threshold: tier.percentThreshold,
        }
    })
}

// ── Output ─────────────────────────────────────────────────────────────────

const STATUS_ICON: Record<Status, string> = {
    ok: "✅",
    skip: "⏭️",
    new: "🆕",
    regression: "🚨",
}

function formatTable(results: Comparison[]): string {
    const lines: string[] = [
        "<!-- bench-regression-check -->",
        "## Benchmark Regression Report",
        "",
        `Compared against **median of last ${WINDOW_SIZE} runs** on \`main\`.`,
        "",
        "| | Benchmark | Valdres | Jotai | vs Jotai | Median | Change |",
        "|:-|:----------|--------:|------:|---------:|-------:|-------:|",
    ]

    for (const r of results) {
        const icon = STATUS_ICON[r.status]
        const valdres = fmtNs(r.valdres)
        const jotai = r.jotai > 0 ? fmtNs(r.jotai) : "—"
        const med = r.median != null ? fmtNs(r.median) : "—"
        const change = fmtChange(r.changePercent)
        lines.push(
            `| ${icon} | ${r.name} | ${valdres} | ${jotai} | ${r.vsJotai} | ${med} | ${change} |`,
        )
    }

    const regressions = results.filter(r => r.status === "regression")
    if (regressions.length > 0) {
        lines.push(
            "",
            `**${regressions.length} regression(s) detected.**`,
        )
    } else {
        lines.push("", "No regressions detected.")
    }

    // Generate threshold tiers table from config to avoid drift
    lines.push(
        "",
        "<details><summary>Threshold tiers</summary>",
        "",
        `Global minimum absolute change: ${MIN_ABSOLUTE_CHANGE_NS}ns`,
        "",
        "| Median range | % threshold | Abs. floor |",
        "|:-------------|:------------|:-----------|",
    )
    for (let i = 0; i < TIERS.length; i++) {
        const tier = TIERS[i]
        const prevMax = i > 0 ? TIERS[i - 1].maxMedianNs : 0
        const range =
            tier.maxMedianNs === Infinity
                ? `> ${fmtNs(prevMax)}`
                : i === 0
                  ? `< ${fmtNs(tier.maxMedianNs)}`
                  : `${fmtNs(prevMax)} – ${fmtNs(tier.maxMedianNs)}`
        const pct =
            tier.percentThreshold === Infinity
                ? "skip (too noisy)"
                : `${((tier.percentThreshold - 1) * 100).toFixed(0)}%`
        const floor =
            tier.absoluteFloorNs > 0 ? fmtNs(tier.absoluteFloorNs) : "—"
        lines.push(`| ${range} | ${pct} | ${floor} |`)
    }
    lines.push("", "</details>")

    return lines.join("\n")
}

async function postOrUpdateComment(body: string): Promise<void> {
    try {
        const token = process.env.GITHUB_TOKEN
        const repo = process.env.GITHUB_REPOSITORY
        if (!token || !repo) {
            console.log(
                "No GITHUB_TOKEN or GITHUB_REPOSITORY — skipping comment.",
            )
            return
        }

        const eventPath = process.env.GITHUB_EVENT_PATH
        if (!eventPath) return
        const event = JSON.parse(readFileSync(eventPath, "utf-8"))
        const prNumber = event?.pull_request?.number
        if (!prNumber) return

        const headers = {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        }
        const baseUrl = `https://api.github.com/repos/${repo}/issues/${prNumber}/comments`
        const marker = "<!-- bench-regression-check -->"

        // Fetch existing comments (per_page=100 to reduce pagination needs)
        const res = await fetch(`${baseUrl}?per_page=100`, { headers })
        if (!res.ok) {
            console.warn(
                `Failed to fetch PR comments (${res.status}) — skipping comment.`,
            )
            return
        }

        const comments = await res.json()
        if (!Array.isArray(comments)) {
            console.warn(
                "Unexpected PR comments response — skipping comment.",
            )
            return
        }

        const existing = comments.find(
            (c: any) => c.body && c.body.includes(marker),
        )

        if (existing) {
            await fetch(
                `${baseUrl.replace(/\/comments$/, "")}/comments/${existing.id}`,
                {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ body }),
                },
            )
            console.log(`Updated existing PR comment #${existing.id}`)
        } else {
            await fetch(baseUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({ body }),
            })
            console.log("Posted new PR comment")
        }
    } catch (err) {
        // Comment failures should not fail the regression check
        console.warn("Failed to post/update PR comment — skipping.", err)
    }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
    const current = readCurrentResults()
    const benchmarks = current.filter(r => r.tag !== "baseline")
    console.log(
        `Read ${current.length} results (${benchmarks.length} comparison benchmarks, ${current.length - benchmarks.length} baselines skipped)`,
    )

    const history = await readHistoricalData()
    if (!history) {
        console.log(
            "No historical data on gh-pages — skipping regression check.",
        )
        process.exit(0)
    }

    const entries = history.entries?.["valdres benchmarks"]
    if (!entries || entries.length === 0) {
        console.log("No historical entries found — skipping regression check.")
        process.exit(0)
    }

    console.log(
        `Found ${entries.length} historical runs (using last ${Math.min(entries.length, WINDOW_SIZE)})`,
    )

    const medians = computeMedians(entries, WINDOW_SIZE)
    const results = compare(current, medians)

    const table = formatTable(results)
    console.log("\n" + table + "\n")

    await postOrUpdateComment(table)

    const regressions = results.filter(r => r.status === "regression")
    if (regressions.length > 0) {
        console.error(
            `❌ ${regressions.length} benchmark regression(s) detected`,
        )
        process.exit(1)
    }

    console.log("✅ No benchmark regressions detected")
}

main()
