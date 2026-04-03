/**
 * Custom benchmark regression checker.
 *
 * Compares current bench-results.json against the median of the last N runs
 * stored on gh-pages. Uses scale-aware thresholds so that sub-nanosecond
 * noise doesn't trigger false positives while real regressions on larger
 * benchmarks are still caught.
 *
 * On PRs: posts/updates a comment with the comparison table.
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

/**
 * Tiers are evaluated in order — the first tier whose maxMedianNs >= median
 * wins. Benchmarks whose median falls in a very small range are too noisy to
 * track and are skipped.
 */
const TIERS: ThresholdTier[] = [
    { maxMedianNs: 100, absoluteFloorNs: 50, percentThreshold: Infinity },
    { maxMedianNs: 1_000, absoluteFloorNs: 100, percentThreshold: 1.5 },
    { maxMedianNs: 100_000, absoluteFloorNs: 0, percentThreshold: 1.3 },
    { maxMedianNs: Infinity, absoluteFloorNs: 0, percentThreshold: 1.2 },
]

// ── Types ──────────────────────────────────────────────────────────────────

interface BenchResult {
    name: string
    unit: string
    value: number
    extra?: string
}

interface HistoricalEntry {
    commit: { id: string }
    date: number
    benches: BenchResult[]
}

interface HistoricalData {
    entries: Record<string, HistoricalEntry[]>
}

type Status = "ok" | "skip" | "new" | "regression"

interface Comparison {
    name: string
    current: number
    median: number | null
    changePercent: number | null
    absoluteChange: number | null
    status: Status
    threshold: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    return `${(ns / 1_000_000).toFixed(2)}ms`
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
const BENCH_JSON = join(ROOT, "bench-results.json")

function readCurrentResults(): BenchResult[] {
    return JSON.parse(readFileSync(BENCH_JSON, "utf-8"))
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

        // data.js has the shape: window.BENCHMARK_DATA = { ... };
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
    current: BenchResult[],
    medians: Map<string, number>,
): Comparison[] {
    return current.map(bench => {
        const med = medians.get(bench.name)

        if (med == null) {
            return {
                name: bench.name,
                current: bench.value,
                median: null,
                changePercent: null,
                absoluteChange: null,
                status: "new" as Status,
                threshold: null,
            }
        }

        const tier = tierFor(med)
        const absoluteChange = bench.value - med
        const changePercent = med > 0 ? bench.value / med : 1

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
            current: bench.value,
            median: med,
            changePercent,
            absoluteChange,
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
        "| Status | Benchmark | Current | Median | Change | Threshold |",
        "|:------:|:----------|--------:|-------:|-------:|----------:|",
    ]

    for (const r of results) {
        const icon = STATUS_ICON[r.status]
        const current = fmtNs(r.current)
        const med = r.median != null ? fmtNs(r.median) : "—"
        const change =
            r.changePercent != null
                ? `${r.changePercent >= 1 ? "+" : ""}${((r.changePercent - 1) * 100).toFixed(0)}%`
                : "—"
        const threshold =
            r.threshold != null && r.threshold !== Infinity
                ? `${((r.threshold - 1) * 100).toFixed(0)}%`
                : "—"
        lines.push(
            `| ${icon} | ${r.name} | ${current} | ${med} | ${change} | ${threshold} |`,
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

    lines.push(
        "",
        "<details><summary>Threshold tiers</summary>",
        "",
        "| Median range | % threshold | Abs. floor |",
        "|:-------------|:------------|:-----------|",
        "| < 100ns | skip (too noisy) | — |",
        "| 100ns – 1µs | 50% | 100ns |",
        "| 1µs – 100µs | 30% | 50ns |",
        "| > 100µs | 20% | 50ns |",
        "",
        "</details>",
    )

    return lines.join("\n")
}

async function postOrUpdateComment(body: string): Promise<void> {
    const token = process.env.GITHUB_TOKEN
    const repo = process.env.GITHUB_REPOSITORY
    if (!token || !repo) {
        console.log("No GITHUB_TOKEN or GITHUB_REPOSITORY — skipping comment.")
        return
    }

    // Get PR number from event payload
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

    // Find existing comment
    const res = await fetch(baseUrl, { headers })
    const comments: any[] = await res.json()
    const existing = comments.find(
        (c: any) => c.body && c.body.includes(marker),
    )

    if (existing) {
        await fetch(`${baseUrl.replace(/\/comments$/, "")}/comments/${existing.id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ body }),
        })
        console.log(`Updated existing PR comment #${existing.id}`)
    } else {
        await fetch(baseUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({ body }),
        })
        console.log("Posted new PR comment")
    }
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
    const current = readCurrentResults()
    console.log(`Read ${current.length} benchmark results from bench-results.json`)

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
