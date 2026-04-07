/**
 * Variance-aware benchmark regression checker.
 *
 * Reads historical data from the benchmark-data branch (compact JSON we
 * control), falls back to gh-pages data.js for backwards compatibility.
 *
 * Key improvements over the original:
 * - Per-benchmark dynamic thresholds based on historical coefficient of
 *   variation (CV). Stable benchmarks get tight thresholds; noisy ones
 *   get lenient thresholds.
 * - Optimization-target benchmarks (threshold >= 10) are tracked but
 *   don't block PRs — they're already gated by the bun test assertion.
 * - Uses median of ratios from last N runs as baseline.
 *
 * Exit code 1 if any regression is detected.
 */
import { readFileSync } from "fs"
import { join } from "path"

// ── Configuration ──────────────────────────────────────────────────────────

const WINDOW_SIZE = 10

/**
 * Base regression threshold — the minimum tolerance applied to any benchmark.
 * Actual threshold is scaled up for benchmarks with high historical variance.
 */
const BASE_THRESHOLD = 1.3

/**
 * Maximum regression threshold — even the noisiest comparison benchmarks
 * won't get a threshold above this.
 */
const MAX_THRESHOLD = 2.0

/**
 * Benchmarks with per-test threshold >= this value are "optimization targets".
 * They are tracked in the report but don't fail the CI.
 */
const OPTIMIZATION_TARGET_THRESHOLD = 10

// ── Types ──────────────────────────────────────────────────────────────────

interface NdjsonResult {
    name: string
    valdres: number
    jotai: number
    ratio: number
    tag: string
    threshold?: number
    cv?: number
}

// Our compact format on benchmark-data branch
interface HistoryBenchmark {
    name: string
    valdres: number
    jotai: number
    ratio: number
    threshold: number
    cv: number
}

interface HistoryEntry {
    date: string
    benchmarks: HistoryBenchmark[]
}

// Legacy format on gh-pages
interface LegacyBench {
    name: string
    value: number
    unit: string
    extra?: string
}

interface LegacyEntry {
    commit: { id: string }
    date: number
    benches: LegacyBench[]
}

interface LegacyData {
    entries: Record<string, LegacyEntry[]>
}

type Status = "ok" | "skip" | "new" | "regression"

interface Comparison {
    name: string
    valdres: number
    jotai: number
    currentRatio: number
    medianRatio: number | null
    ratioChange: number | null
    threshold: number | null
    // Self-vs-self absolute timing comparison
    medianValdres: number | null
    absChange: number | null // >1 means slower, <1 means faster
    absThreshold: number | null
    absStatus: Status
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

function computeCV(values: number[]): number {
    if (values.length < 2) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    if (mean === 0) return 0
    const variance =
        values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
    return Math.sqrt(variance) / mean
}

/**
 * Dynamic regression threshold based on historical CV of the ratio.
 * Stable benchmarks (CV ~0%) get BASE_THRESHOLD (30%).
 * Noisy benchmarks (CV ~50%+) get up to MAX_THRESHOLD (100%).
 * E.g., CV=10% → ~44%, CV=25% → ~65%.
 */
function dynamicThreshold(historicalCV: number): number {
    // Scale: BASE_THRESHOLD at CV=0, linear up to MAX_THRESHOLD at CV=0.5+
    const scaled = BASE_THRESHOLD + historicalCV * (MAX_THRESHOLD - BASE_THRESHOLD) / 0.5
    return Math.min(Math.max(scaled, BASE_THRESHOLD), MAX_THRESHOLD)
}

// ── Data loading ──────────────────────────────────────────────────────────

const ROOT = join(import.meta.dir, "..")
const NDJSON_PATH = join(
    ROOT,
    "packages/valdres/test/performance/bench-results.ndjson",
)

function readCurrentResults(): NdjsonResult[] {
    const ndjson = readFileSync(NDJSON_PATH, "utf-8").trim()
    return ndjson.split("\n").map(line => JSON.parse(line))
}

async function gitShow(ref: string): Promise<string | null> {
    try {
        const proc = Bun.spawn(["git", "show", ref], {
            stdout: "pipe",
            stderr: "pipe",
        })
        const raw = await new Response(proc.stdout).text()
        const exitCode = await proc.exited
        return exitCode === 0 ? raw : null
    } catch {
        return null
    }
}

interface HistoricalData {
    medianRatios: Map<string, number>
    ratioCvByName: Map<string, number>
    // Self-vs-self: absolute valdres timings (noisier than ratios)
    medianValdres: Map<string, number>
    valdresCvByName: Map<string, number>
    source: "benchmark-data" | "gh-pages"
    entryCount: number
}

/**
 * Minimum entries needed before benchmark-data is trusted over gh-pages.
 * With fewer entries, CV is unreliable and thresholds would be too tight.
 */
const MIN_ENTRIES_FOR_NEW_FORMAT = 5

async function loadHistory(): Promise<HistoricalData | null> {
    // Try benchmark-data branch first (new compact format),
    // but only if it has enough entries for reliable CV computation
    const benchData = await gitShow("origin/benchmark-data:results.json")
    if (benchData) {
        try {
            const entries: HistoryEntry[] = JSON.parse(benchData)
            if (entries.length >= MIN_ENTRIES_FOR_NEW_FORMAT) {
                return computeFromBenchmarkData(entries)
            }
            if (entries.length > 0) {
                console.log(
                    `benchmark-data has ${entries.length} entries (need ${MIN_ENTRIES_FOR_NEW_FORMAT}) — falling back to gh-pages`,
                )
            }
        } catch {
            console.warn("Failed to parse benchmark-data:results.json")
        }
    }

    // Fall back to gh-pages (legacy format)
    const ghPages = await gitShow("origin/gh-pages:dev/bench/data.js")
    if (ghPages) {
        try {
            const json = ghPages
                .replace(/^window\.BENCHMARK_DATA\s*=\s*/, "")
                .replace(/;\s*$/, "")
            const data: LegacyData = JSON.parse(json)
            const entries = data.entries?.["valdres benchmarks"]
            if (entries && entries.length > 0) {
                return computeFromLegacy(entries)
            }
        } catch {
            console.warn("Failed to parse gh-pages data.js")
        }
    }

    return null
}

function computeFromBenchmarkData(entries: HistoryEntry[]): HistoricalData {
    const recent = entries.slice(-WINDOW_SIZE)
    const ratiosByName = new Map<string, number[]>()
    const valdresByName = new Map<string, number[]>()

    for (const entry of recent) {
        for (const bench of entry.benchmarks) {
            if (!ratiosByName.has(bench.name)) ratiosByName.set(bench.name, [])
            ratiosByName.get(bench.name)!.push(bench.ratio)
            if (!valdresByName.has(bench.name)) valdresByName.set(bench.name, [])
            valdresByName.get(bench.name)!.push(bench.valdres)
        }
    }

    const medianRatios = new Map<string, number>()
    const ratioCvByName = new Map<string, number>()
    for (const [name, values] of ratiosByName) {
        medianRatios.set(name, median(values))
        ratioCvByName.set(name, computeCV(values))
    }

    const medianValdres = new Map<string, number>()
    const valdresCvByName = new Map<string, number>()
    for (const [name, values] of valdresByName) {
        medianValdres.set(name, median(values))
        valdresCvByName.set(name, computeCV(values))
    }

    return {
        medianRatios,
        ratioCvByName,
        medianValdres,
        valdresCvByName,
        source: "benchmark-data",
        entryCount: entries.length,
    }
}

function computeFromLegacy(entries: LegacyEntry[]): HistoricalData {
    const recent = entries.slice(-WINDOW_SIZE)
    const ratiosByName = new Map<string, number[]>()
    const valdresByName = new Map<string, number[]>()

    for (const entry of recent) {
        for (const bench of entry.benches) {
            if (!bench.extra || bench.extra === "baseline") continue
            const match = bench.extra.match(/ratio=([\d.]+)/)
            if (!match) continue
            ratiosByName.set(bench.name, [...(ratiosByName.get(bench.name) ?? []), parseFloat(match[1])])
            valdresByName.set(bench.name, [...(valdresByName.get(bench.name) ?? []), bench.value])
        }
    }

    const medianRatios = new Map<string, number>()
    const ratioCvByName = new Map<string, number>()
    for (const [name, values] of ratiosByName) {
        medianRatios.set(name, median(values))
        ratioCvByName.set(name, computeCV(values))
    }

    const medianValdres = new Map<string, number>()
    const valdresCvByName = new Map<string, number>()
    for (const [name, values] of valdresByName) {
        medianValdres.set(name, median(values))
        valdresCvByName.set(name, computeCV(values))
    }

    return {
        medianRatios,
        ratioCvByName,
        medianValdres,
        valdresCvByName,
        source: "gh-pages",
        entryCount: entries.length,
    }
}

// ── Comparison ────────────────────────────────────────────────────────────

function compare(
    current: NdjsonResult[],
    history: HistoricalData,
): Comparison[] {
    const benchmarks = current.filter(r => r.tag !== "baseline")

    return benchmarks.map(bench => {
        const currentRatio = bench.jotai > 0 ? bench.valdres / bench.jotai : 1
        const medRatio = history.medianRatios.get(bench.name)
        const ratioCV = history.ratioCvByName.get(bench.name) ?? 0

        // Self-vs-self: compare absolute valdres timing against historical median
        const medVal = history.medianValdres.get(bench.name)
        const valCV = history.valdresCvByName.get(bench.name) ?? 0
        const absChange = medVal ? bench.valdres / medVal : null
        const absThreshold = medVal ? dynamicThreshold(valCV) : null
        const absStatus: Status =
            absChange != null && absThreshold != null && absChange > absThreshold
                ? "regression"
                : medVal == null
                  ? "new"
                  : "ok"

        // Optimization targets are tracked but don't block PRs
        const isOptTarget =
            (bench.threshold ?? 0) >= OPTIMIZATION_TARGET_THRESHOLD

        if (isOptTarget) {
            return {
                name: bench.name,
                valdres: bench.valdres,
                jotai: bench.jotai,
                currentRatio,
                medianRatio: medRatio ?? null,
                ratioChange: medRatio ? currentRatio / medRatio : null,
                threshold: null,
                medianValdres: medVal ?? null,
                absChange,
                absThreshold,
                absStatus: "skip" as Status,
                status: "skip" as Status,
            }
        }

        if (medRatio == null) {
            return {
                name: bench.name,
                valdres: bench.valdres,
                jotai: bench.jotai,
                currentRatio,
                medianRatio: null,
                ratioChange: null,
                threshold: null,
                medianValdres: medVal ?? null,
                absChange,
                absThreshold,
                absStatus,
                status: "new" as Status,
            }
        }

        const ratioChange = currentRatio / medRatio
        const threshold = dynamicThreshold(ratioCV)

        const status: Status =
            ratioChange > threshold ? "regression" : "ok"

        return {
            name: bench.name,
            valdres: bench.valdres,
            jotai: bench.jotai,
            currentRatio,
            medianRatio: medRatio,
            ratioChange,
            threshold,
            medianValdres: medVal ?? null,
            absChange,
            absThreshold,
            absStatus,
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

function formatTable(
    results: Comparison[],
    runNumber: number,
    historySource: string,
    windowUsed: number,
): string {
    const lines: string[] = [
        "<!-- bench-regression-check -->",
        "## Benchmark Regression Report",
        "",
        `Compared **valdres/jotai ratio** against median of last ${windowUsed} runs on \`main\` (source: \`${historySource}\`).`,
        `Thresholds are dynamic per-benchmark based on historical variance.`,
        "",
        "| | Benchmark | Valdres | Jotai | vs Jotai | Baseline | Change | Threshold |",
        "|:-|:----------|--------:|------:|---------:|---------:|-------:|----------:|",
    ]

    for (const r of results) {
        const icon = STATUS_ICON[r.status]
        const valdres = fmtNs(r.valdres)
        const jotai = r.jotai > 0 ? fmtNs(r.jotai) : "—"
        const vsJotai = fmtRatio(r.currentRatio)
        const baseline = r.medianRatio != null ? fmtRatio(r.medianRatio) : "—"
        const change = fmtChange(r.ratioChange)
        const thresh =
            r.status === "skip"
                ? "opt target"
                : r.threshold != null
                  ? `${((r.threshold - 1) * 100).toFixed(0)}%`
                  : "—"
        lines.push(
            `| ${icon} | ${r.name} | ${valdres} | ${jotai} | ${vsJotai} | ${baseline} | ${change} | ${thresh} |`,
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

    // Self-vs-self absolute timing section (informational, does not gate CI)
    const selfResults = results.filter(
        r => r.medianValdres != null && r.absStatus !== "skip",
    )
    if (selfResults.length > 0) {
        lines.push(
            "",
            "<details>",
            "<summary>Self-vs-self timing (does not gate CI)</summary>",
            "",
            "Compares absolute valdres timings against historical median. Noisier than ratio comparison (no runner-variance cancellation), but catches regressions invisible to the jotai ratio.",
            "",
            "| | Benchmark | Current | Baseline | Change | Threshold |",
            "|:-|:----------|--------:|---------:|-------:|----------:|",
        )

        for (const r of selfResults) {
            const icon = STATUS_ICON[r.absStatus]
            const current = fmtNs(r.valdres)
            const baseline =
                r.medianValdres != null ? fmtNs(r.medianValdres) : "—"
            const change = fmtChange(r.absChange)
            const thresh =
                r.absThreshold != null
                    ? `${((r.absThreshold - 1) * 100).toFixed(0)}%`
                    : "—"
            lines.push(
                `| ${icon} | ${r.name} | ${current} | ${baseline} | ${change} | ${thresh} |`,
            )
        }

        const absRegressions = selfResults.filter(
            r => r.absStatus === "regression",
        )
        if (absRegressions.length > 0) {
            lines.push(
                "",
                `${absRegressions.length} absolute timing regression(s) — review recommended.`,
            )
        }

        lines.push("", "</details>")
    }

    if (runNumber > 0) {
        const now = new Date()
            .toISOString()
            .replace("T", " ")
            .replace(/\.\d+Z$/, " UTC")
        lines.push("", `<sub>Run #${runNumber} · Updated ${now}</sub>`)
    }

    return lines.join("\n")
}

async function postOrUpdateComment(
    formatBody: (runNumber: number) => string,
): Promise<void> {
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

    const history = await loadHistory()
    if (!history) {
        console.log(
            "No historical data found — skipping regression check.",
        )
        process.exit(0)
    }

    if (history.medianRatios.size === 0) {
        console.log(
            "No historical ratio data found — skipping regression check.",
        )
        process.exit(0)
    }

    const windowUsed = Math.min(history.entryCount, WINDOW_SIZE)
    console.log(
        `Found ${history.entryCount} historical runs on ${history.source} (using last ${windowUsed})`,
    )

    // Log per-benchmark CV and dynamic thresholds
    for (const [name, cv] of history.ratioCvByName) {
        const thresh = dynamicThreshold(cv)
        const absCV = history.valdresCvByName.get(name)
        const absPart = absCV != null ? ` | abs CV=${(absCV * 100).toFixed(1)}%` : ""
        console.log(
            `  ${name}: ratio CV=${(cv * 100).toFixed(1)}% → threshold=${((thresh - 1) * 100).toFixed(0)}%${absPart}`,
        )
    }

    const results = compare(current, history)

    console.log(
        "\n" + formatTable(results, 0, history.source, windowUsed) + "\n",
    )

    await postOrUpdateComment(runNumber =>
        formatTable(results, runNumber, history.source, windowUsed),
    )

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
