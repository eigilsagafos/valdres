/**
 * Ratio-based benchmark regression checker.
 *
 * Compares the valdres/jotai ratio from the current run against the median
 * ratio from the last N runs on gh-pages. Since both libraries run on the
 * same machine, the ratio cancels out CI runner variance — a slower runner
 * slows both equally, keeping the ratio stable.
 *
 * Exit code 1 if any regression is detected.
 */
import { readFileSync } from "fs"
import { join } from "path"

// ── Configuration ──────────────────────────────────────────────────────────

const WINDOW_SIZE = 10 // number of recent runs to take the median of

/**
 * How much worse the ratio can get before it's flagged.
 * E.g., 1.5 means the ratio can increase by 50% before it's a regression.
 * If historical median ratio was 0.5 (2x faster), a regression threshold
 * of 1.5 means it fails at 0.75 (1.33x faster) — a real slowdown.
 */
const RATIO_REGRESSION_THRESHOLD = 1.5

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
    currentRatio: number
    medianRatio: number | null
    ratioChange: number | null
    status: Status
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    return `${(ns / 1_000_000).toFixed(2)}ms`
}

function fmtRatio(ratio: number): string {
    return ratio <= 1
        ? `${(1 / ratio).toFixed(1)}x faster`
        : `${ratio.toFixed(1)}x slower`
}

function fmtChange(ratioChange: number | null): string {
    if (ratioChange == null) return "—"
    const pct = Math.abs((ratioChange - 1) * 100)
    return ratioChange >= 1
        ? `${pct.toFixed(0)}% worse`
        : `${pct.toFixed(0)}% better`
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2
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

function parseRatioFromExtra(extra?: string): number | null {
    if (!extra) return null
    const match = extra.match(/ratio=([\d.]+)/)
    return match ? parseFloat(match[1]) : null
}

function computeMedianRatios(
    entries: HistoricalEntry[],
    windowSize: number,
): Map<string, number> {
    const recent = entries.slice(-windowSize)
    const byName = new Map<string, number[]>()

    for (const entry of recent) {
        for (const bench of entry.benches) {
            const ratio = parseRatioFromExtra(bench.extra)
            if (ratio == null) continue
            if (!byName.has(bench.name)) byName.set(bench.name, [])
            byName.get(bench.name)!.push(ratio)
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
    medianRatios: Map<string, number>,
): Comparison[] {
    const benchmarks = current.filter(r => r.tag !== "baseline")

    return benchmarks.map(bench => {
        const currentRatio = bench.jotai > 0 ? bench.valdres / bench.jotai : 1
        const medRatio = medianRatios.get(bench.name)

        if (medRatio == null) {
            return {
                name: bench.name,
                valdres: bench.valdres,
                jotai: bench.jotai,
                currentRatio,
                medianRatio: null,
                ratioChange: null,
                status: "new" as Status,
            }
        }

        // How much did the ratio worsen? >1 means worse, <1 means better.
        // E.g., if median was 0.5 (2x faster) and now it's 0.75 (1.33x faster),
        // ratioChange = 0.75 / 0.5 = 1.5 — 50% worse.
        const ratioChange = currentRatio / medRatio

        const status: Status =
            ratioChange > RATIO_REGRESSION_THRESHOLD ? "regression" : "ok"

        return {
            name: bench.name,
            valdres: bench.valdres,
            jotai: bench.jotai,
            currentRatio,
            medianRatio: medRatio,
            ratioChange,
            status,
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

function formatTable(results: Comparison[], runNumber: number): string {
    const lines: string[] = [
        "<!-- bench-regression-check -->",
        "## Benchmark Regression Report",
        "",
        `Compared **valdres/jotai ratio** against median of last ${WINDOW_SIZE} runs on \`main\`.`,
        `Regression threshold: ratio worsened by more than ${((RATIO_REGRESSION_THRESHOLD - 1) * 100).toFixed(0)}%.`,
        "",
        "| | Benchmark | Valdres | Jotai | vs Jotai | Baseline | Change |",
        "|:-|:----------|--------:|------:|---------:|---------:|-------:|",
    ]

    for (const r of results) {
        const icon = STATUS_ICON[r.status]
        const valdres = fmtNs(r.valdres)
        const jotai = r.jotai > 0 ? fmtNs(r.jotai) : "—"
        const vsJotai = fmtRatio(r.currentRatio)
        const baseline = r.medianRatio != null ? fmtRatio(r.medianRatio) : "—"
        const change = fmtChange(r.ratioChange)
        lines.push(
            `| ${icon} | ${r.name} | ${valdres} | ${jotai} | ${vsJotai} | ${baseline} | ${change} |`,
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

    if (runNumber > 0) {
        const now = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")
        lines.push("", `<sub>Run #${runNumber} · Updated ${now}</sub>`)
    }

    return lines.join("\n")
}

async function postOrUpdateComment(formatBody: (runNumber: number) => string): Promise<void> {
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

        let runNumber = 1
        if (existing) {
            const match = existing.body?.match(/Run #(\d+)/)
            if (match) runNumber = parseInt(match[1], 10) + 1
        }

        const body = formatBody(runNumber)

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

    const medianRatios = computeMedianRatios(entries, WINDOW_SIZE)

    if (medianRatios.size === 0) {
        console.log(
            "No historical ratio data found (older format?) — skipping regression check.",
        )
        process.exit(0)
    }

    const results = compare(current, medianRatios)

    // Log without run number (only meaningful on the PR comment)
    console.log("\n" + formatTable(results, 0) + "\n")

    await postOrUpdateComment((runNumber) => formatTable(results, runNumber))

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
