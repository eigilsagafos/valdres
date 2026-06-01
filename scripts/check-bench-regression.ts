/**
 * Variance-aware benchmark regression checker.
 *
 * Reads historical data from the benchmark-data branch (compact JSON we
 * control), falls back to gh-pages data.js for backwards compatibility.
 *
 * Key design decisions:
 * - Per-benchmark dynamic thresholds based on historical coefficient of
 *   variation (CV). Stable benchmarks get tight thresholds; noisy ones
 *   get lenient thresholds.
 * - Single-check gating on the paired ratio (valdres / jotai). Both are
 *   measured in the same run on the same hardware, so the ratio cancels
 *   out runner-level slowdowns that affect both libraries equally — only
 *   a change in valdres's performance relative to Jotai trips the check.
 * - Noise floor: benchmarks with median < 500ns are auto-skipped from
 *   gating — nanosecond-scale measurements are dominated by CI noise.
 * - Optimization-target benchmarks (threshold >= 10) are tracked but
 *   don't block PRs — they're already gated by the bun test assertion.
 * - Uses median of ratios from last N runs as baseline.
 *
 * Exit code 1 if any regression is detected.
 */
import { readFileSync } from "fs"
import { join } from "path"
import { groupByCategory } from "./lib/bench-categories"
import { type BenchResult, readBenchResults } from "./lib/read-bench-results"

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

/**
 * Noise floor in nanoseconds. Benchmarks with historical median absolute
 * timing below this are dominated by measurement noise (GC pauses, CPU
 * scheduling) and are automatically treated as optimization targets for
 * regression gating purposes.
 */
const NOISE_FLOOR_NS = 500

// ── Types ──────────────────────────────────────────────────────────────────

type NdjsonResult = BenchResult

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
    // Added later — older entries on benchmark-data may omit this.
    nodeBenchmarks?: HistoryBenchmark[]
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

function fmtChange(change: number | null): string {
    if (change == null) return "—"
    const pct = Math.abs((change - 1) * 100)
    if (pct < 1) return "~same"
    return change < 1
        ? `🟢 ${pct.toFixed(0)}% faster`
        : `🔴 ${pct.toFixed(0)}% slower`
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
const PERF_DIR = join(ROOT, "packages/valdres/test/performance")
const BUN_NDJSON_PATH = join(PERF_DIR, "bench-results.ndjson")
const NODE_NDJSON_PATH = join(PERF_DIR, "bench-results-node.ndjson")

// Same-runner A/B: when scripts/run-bench-ab.ts has produced a parallel
// main-checkout run, its bench-results.ndjson lives here. Presence of
// this file flips the checker into A/B mode and disables the historical
// baseline as the gating signal.
const MAIN_BUN_NDJSON_PATH = join(
    ROOT,
    ".bench-main/packages/valdres/test/performance/bench-results.ndjson",
)

// A/B regression gate. The orchestrator runs each side K times; we gate on
// min(valdres_PR) / min(valdres_main). The minimum is the least-contended
// run — the CPU floor — which is far stabler than any single run's median,
// so a tight-ish flat threshold is honest. 20% leaves headroom for residual
// floor jitter on shared CI runners while still catching real regressions
// (a genuine slowdown moves the floor too). Tune after a few PRs.
const AB_REGRESSION_THRESHOLD = 1.2

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
    // Median absolute valdres timing — used only for the noise-floor check.
    medianValdres: Map<string, number>
    source: "benchmark-data" | "gh-pages"
    entryCount: number
}

interface LoadedHistory {
    bun: HistoricalData
    // Node history only exists on the benchmark-data branch and may be empty
    // for older entries that pre-date V8 tracking.
    node: HistoricalData | null
}

/**
 * Minimum entries needed before benchmark-data is trusted over gh-pages.
 * With fewer entries, CV is unreliable and thresholds would be too tight.
 */
const MIN_ENTRIES_FOR_NEW_FORMAT = 5

async function loadHistory(): Promise<LoadedHistory | null> {
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

    // Fall back to gh-pages (legacy format) — Bun only.
    const ghPages = await gitShow("origin/gh-pages:dev/bench/data.js")
    if (ghPages) {
        try {
            const json = ghPages
                .replace(/^window\.BENCHMARK_DATA\s*=\s*/, "")
                .replace(/;\s*$/, "")
            const data: LegacyData = JSON.parse(json)
            const entries = data.entries?.["valdres benchmarks"]
            if (entries && entries.length > 0) {
                return { bun: computeFromLegacy(entries), node: null }
            }
        } catch {
            console.warn("Failed to parse gh-pages data.js")
        }
    }

    return null
}

function computeSeriesData(
    seriesPerEntry: HistoryBenchmark[][],
): Pick<HistoricalData, "medianRatios" | "ratioCvByName" | "medianValdres"> {
    const ratiosByName = new Map<string, number[]>()
    const valdresByName = new Map<string, number[]>()

    for (const benches of seriesPerEntry) {
        for (const bench of benches) {
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
    for (const [name, values] of valdresByName) {
        medianValdres.set(name, median(values))
    }

    return { medianRatios, ratioCvByName, medianValdres }
}

function computeFromBenchmarkData(entries: HistoryEntry[]): LoadedHistory {
    const recent = entries.slice(-WINDOW_SIZE)

    const bun: HistoricalData = {
        ...computeSeriesData(recent.map(e => e.benchmarks)),
        source: "benchmark-data",
        entryCount: entries.length,
    }

    const nodeEntries = recent.filter(e => (e.nodeBenchmarks?.length ?? 0) > 0)
    const node: HistoricalData | null =
        nodeEntries.length > 0
            ? {
                  ...computeSeriesData(nodeEntries.map(e => e.nodeBenchmarks!)),
                  source: "benchmark-data",
                  entryCount: nodeEntries.length,
              }
            : null

    return { bun, node }
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
            if (!ratiosByName.has(bench.name)) ratiosByName.set(bench.name, [])
            ratiosByName.get(bench.name)!.push(parseFloat(match[1]))
            if (!valdresByName.has(bench.name)) valdresByName.set(bench.name, [])
            valdresByName.get(bench.name)!.push(bench.value)
        }
    }

    const medianRatios = new Map<string, number>()
    const ratioCvByName = new Map<string, number>()
    for (const [name, values] of ratiosByName) {
        medianRatios.set(name, median(values))
        ratioCvByName.set(name, computeCV(values))
    }

    const medianValdres = new Map<string, number>()
    for (const [name, values] of valdresByName) {
        medianValdres.set(name, median(values))
    }

    return {
        medianRatios,
        ratioCvByName,
        medianValdres,
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
        const medVal = history.medianValdres.get(bench.name)

        // Optimization targets are tracked but don't block PRs.
        // Also treat sub-microsecond benchmarks as opt targets — their
        // nanosecond-scale measurements are dominated by noise on shared CI.
        const isOptTarget =
            (bench.threshold ?? 0) >= OPTIMIZATION_TARGET_THRESHOLD ||
            (medVal != null && medVal < NOISE_FLOOR_NS)

        if (isOptTarget) {
            return {
                name: bench.name,
                valdres: bench.valdres,
                jotai: bench.jotai,
                currentRatio,
                medianRatio: medRatio ?? null,
                ratioChange: medRatio ? currentRatio / medRatio : null,
                threshold: null,
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

function renderResultsBlock(
    results: Comparison[],
    title: string,
    windowUsed: number,
    showLegend: boolean,
): string[] {
    const hasHistory = windowUsed > 0
    const historicalHeader = hasHistory
        ? `Historical (${windowUsed}-run median)`
        : ""
    const headerRow = hasHistory
        ? `| | Benchmark | Valdres | Jotai | vs Jotai | ${historicalHeader} | Δ |`
        : `| | Benchmark | Valdres | Jotai | vs Jotai |`
    const alignRow = hasHistory
        ? "|:-|:----------|--------:|------:|--------:|--------:|:----------|"
        : "|:-|:----------|--------:|------:|--------:|"

    const renderRow = (r: Comparison): string => {
        const icon = STATUS_ICON[r.status]
        const valdres = fmtNs(r.valdres)
        const jotai = fmtNs(r.jotai)
        const vsJotai = fmtRatio(r.currentRatio)
        if (!hasHistory) {
            return `| ${icon} | ${r.name} | ${valdres} | ${jotai} | ${vsJotai} |`
        }
        const historical = r.medianRatio != null ? fmtRatio(r.medianRatio) : "—"
        const delta = fmtChange(r.ratioChange)
        return `| ${icon} | ${r.name} | ${valdres} | ${jotai} | ${vsJotai} | ${historical} | ${delta} |`
    }

    const lines: string[] = [
        "<details>",
        `<summary>${title}</summary>`,
        "",
    ]

    const grouped = groupByCategory(results, r => r.name)
    for (const [cat, benchmarks] of grouped) {
        lines.push(`**${cat}**`, "", headerRow, alignRow)
        for (const r of benchmarks) lines.push(renderRow(r))
        lines.push("")
    }

    if (showLegend) {
        lines.push(
            "**Legend:** ✅ pass · 🚨 regression · ⏭️ skipped (opt target or below noise floor) · 🆕 new",
            "",
        )
    }

    lines.push("</details>")
    return lines
}

function formatTable(
    bunResults: Comparison[],
    nodeResults: Comparison[] | null,
    nodeWindowUsed: number,
    runNumber: number,
    bunWindowUsed: number,
): string {
    const regressions = bunResults.filter(r => r.status === "regression")

    const lines: string[] = [
        "<!-- bench-regression-check -->",
        "## Benchmark Regression Report",
        "",
    ]

    // ── Summary line (the only thing most reviewers need) ──
    if (regressions.length > 0) {
        lines.push(
            `🚨 **${regressions.length} regression(s) detected** — paired ratio vs Jotai exceeded threshold.`,
        )
    } else {
        lines.push("✅ **No regressions detected.**")
    }

    lines.push(
        "",
        `<sub>**How to read this:** _Valdres_ and _Jotai_ are this run's median timings. _vs Jotai_ is their ratio. _Historical_ is the median ratio from the last ${bunWindowUsed} runs on \`main\`. _Δ_ compares this run's ratio against that historical median — 🟢 faster, 🔴 slower. Regression gating runs against JSC (Bun) only; V8 (Node.js) is tracked informationally.</sub>`,
    )

    // ── Inline flagged regressions (Bun only) ──
    if (regressions.length > 0) {
        const historicalHeader = `Historical (${bunWindowUsed}-run median)`
        lines.push(
            "",
            `| | Benchmark | Valdres | Jotai | vs Jotai | ${historicalHeader} | Δ |`,
            "|:-|:----------|--------:|------:|--------:|--------:|:----------|",
        )
        for (const r of regressions) {
            const icon = STATUS_ICON[r.status]
            const historical =
                r.medianRatio != null ? fmtRatio(r.medianRatio) : "—"
            lines.push(
                `| ${icon} | ${r.name} | ${fmtNs(r.valdres)} | ${fmtNs(r.jotai)} | ${fmtRatio(r.currentRatio)} | ${historical} | ${fmtChange(r.ratioChange)} |`,
            )
        }
    }

    // ── JSC (Bun) full results ──
    lines.push("")
    lines.push(
        ...renderResultsBlock(
            bunResults,
            `JSC (Bun / Safari) — ${bunResults.length} benchmarks vs last ${bunWindowUsed} runs on <code>main</code>`,
            bunWindowUsed,
            true,
        ),
    )

    // ── V8 (Node.js) full results ──
    if (nodeResults && nodeResults.length > 0) {
        const nodeTitle =
            nodeWindowUsed > 0
                ? `V8 (Node.js / Chrome) — ${nodeResults.length} benchmarks vs last ${nodeWindowUsed} runs on <code>main</code> · informational`
                : `V8 (Node.js / Chrome) — ${nodeResults.length} benchmarks · informational (no historical baseline yet)`
        lines.push("")
        lines.push(
            ...renderResultsBlock(
                nodeResults,
                nodeTitle,
                nodeWindowUsed,
                false,
            ),
        )
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

// ── Same-runner A/B mode ──────────────────────────────────────────────────
//
// Engaged when scripts/run-bench-ab.ts has produced a second ndjson from a
// parallel run of the same bench suite against `origin/main` in the same
// CI VM. Per-benchmark gate becomes valdres_PR / valdres_main on absolute
// timings, with a flat threshold. The "vs Jotai" column survives for
// orientation but no longer informs the gate.

interface ABComparison {
    name: string
    valdresPr: number
    valdresMain: number | null
    jotaiPr: number
    jotaiMain: number | null
    /** valdres_PR / valdres_main; null when no main counterpart. */
    deltaVsMain: number | null
    /** valdres_PR / jotai_PR — purely for the orientation column. */
    currentRatio: number
    /** Threshold actually applied (or null when status is skip/new). */
    threshold: number | null
    status: Status
}

function compareAB(
    prRaw: NdjsonResult[],
    mainRaw: NdjsonResult[],
): ABComparison[] {
    const pr = prRaw.filter(r => r.tag !== "baseline")
    const mainByName = new Map(
        mainRaw.filter(r => r.tag !== "baseline").map(r => [r.name, r]),
    )

    return pr.map(prBench => {
        const ratioPr =
            prBench.jotai > 0 ? prBench.valdres / prBench.jotai : 1
        const mainBench = mainByName.get(prBench.name)

        if (!mainBench) {
            // Bench file is new in this PR, or the main pass failed for
            // this file. Either way: no baseline, nothing to gate against.
            return {
                name: prBench.name,
                valdresPr: prBench.valdres,
                valdresMain: null,
                jotaiPr: prBench.jotai,
                jotaiMain: null,
                deltaVsMain: null,
                currentRatio: ratioPr,
                threshold: null,
                status: "new" as Status,
            }
        }

        const delta = prBench.valdres / mainBench.valdres

        // Noise floor — sub-µs benches on shared CI bounce ±30% on
        // measurement noise alone even on the same VM. Report them but
        // don't gate. Apply to either side: if main was sub-µs the
        // baseline is unreliable; if PR is sub-µs the new number is.
        const belowNoise =
            mainBench.valdres < NOISE_FLOOR_NS ||
            prBench.valdres < NOISE_FLOOR_NS

        if (belowNoise) {
            return {
                name: prBench.name,
                valdresPr: prBench.valdres,
                valdresMain: mainBench.valdres,
                jotaiPr: prBench.jotai,
                jotaiMain: mainBench.jotai,
                deltaVsMain: delta,
                currentRatio: ratioPr,
                threshold: null,
                status: "skip" as Status,
            }
        }

        const status: Status =
            delta > AB_REGRESSION_THRESHOLD ? "regression" : "ok"

        return {
            name: prBench.name,
            valdresPr: prBench.valdres,
            valdresMain: mainBench.valdres,
            jotaiPr: prBench.jotai,
            jotaiMain: mainBench.jotai,
            deltaVsMain: delta,
            currentRatio: ratioPr,
            threshold: AB_REGRESSION_THRESHOLD,
            status,
        }
    })
}

function fmtDelta(delta: number | null): string {
    if (delta == null) return "—"
    const pct = (delta - 1) * 100
    if (Math.abs(pct) < 1) return "~same"
    return pct < 0
        ? `🟢 ${Math.abs(pct).toFixed(0)}% faster`
        : `🔴 ${pct.toFixed(0)}% slower`
}

function renderABResultsBlock(
    results: ABComparison[],
    title: string,
    showLegend: boolean,
): string[] {
    const headerRow =
        "| | Benchmark | PR | Main | Δ vs Main | vs Jotai (PR) |"
    const alignRow =
        "|:-|:----------|---:|-----:|----------:|--------------:|"

    const renderRow = (r: ABComparison): string => {
        const icon = STATUS_ICON[r.status]
        const pr = fmtNs(r.valdresPr)
        const main = r.valdresMain != null ? fmtNs(r.valdresMain) : "—"
        const delta = fmtDelta(r.deltaVsMain)
        const vsJotai = fmtRatio(r.currentRatio)
        return `| ${icon} | ${r.name} | ${pr} | ${main} | ${delta} | ${vsJotai} |`
    }

    const lines: string[] = [
        "<details>",
        `<summary>${title}</summary>`,
        "",
    ]

    const grouped = groupByCategory(results, r => r.name)
    for (const [cat, benchmarks] of grouped) {
        lines.push(`**${cat}**`, "", headerRow, alignRow)
        for (const r of benchmarks) lines.push(renderRow(r))
        lines.push("")
    }

    if (showLegend) {
        lines.push(
            `**Legend:** ✅ pass · 🚨 regression (PR ≥${((AB_REGRESSION_THRESHOLD - 1) * 100).toFixed(0)}% slower than main) · ⏭️ skipped (below ${NOISE_FLOOR_NS}ns noise floor) · 🆕 new (no main counterpart)`,
            "",
        )
    }

    lines.push("</details>")
    return lines
}

function renderInfoNodeBlock(
    results: NdjsonResult[],
    title: string,
): string[] {
    const benches = results.filter(r => r.tag !== "baseline")

    const headerRow = "| Benchmark | Valdres | Jotai | vs Jotai |"
    const alignRow = "|:----------|--------:|------:|---------:|"

    const lines: string[] = [
        "<details>",
        `<summary>${title}</summary>`,
        "",
    ]

    const grouped = groupByCategory(benches, r => r.name)
    for (const [cat, bs] of grouped) {
        lines.push(`**${cat}**`, "", headerRow, alignRow)
        for (const r of bs) {
            const ratio = r.jotai > 0 ? r.valdres / r.jotai : 1
            lines.push(
                `| ${r.name} | ${fmtNs(r.valdres)} | ${fmtNs(r.jotai)} | ${fmtRatio(ratio)} |`,
            )
        }
        lines.push("")
    }

    lines.push("</details>")
    return lines
}

function formatABTable(
    abResults: ABComparison[],
    nodeRaw: NdjsonResult[],
    runNumber: number,
): string {
    const regressions = abResults.filter(r => r.status === "regression")

    const lines: string[] = [
        "<!-- bench-regression-check -->",
        "## Benchmark Regression Report",
        "",
    ]

    if (regressions.length > 0) {
        lines.push(
            `🚨 **${regressions.length} regression(s) detected** — PR is ≥${((AB_REGRESSION_THRESHOLD - 1) * 100).toFixed(0)}% slower than \`main\` on the same VM.`,
        )
    } else {
        lines.push("✅ **No regressions detected.**")
    }

    lines.push(
        "",
        `<sub>**How to read this:** _PR_ and _Main_ are the **fastest of several rounds** for each side — the least-contended run, which approximates the true CPU floor and is far stabler than a single run. Both branches ran in the same CI VM, so runner-level noise (CPU class, neighbours, frequency state) cancels. _Δ vs Main_ is the gating signal. _vs Jotai_ is shown for orientation only. Regression gating runs against JSC (Bun) only; V8 (Node.js) is informational and not A/B-compared.</sub>`,
    )

    if (regressions.length > 0) {
        lines.push(
            "",
            "| | Benchmark | PR | Main | Δ vs Main |",
            "|:-|:----------|---:|-----:|----------:|",
        )
        for (const r of regressions) {
            lines.push(
                `| ${STATUS_ICON[r.status]} | ${r.name} | ${fmtNs(r.valdresPr)} | ${r.valdresMain != null ? fmtNs(r.valdresMain) : "—"} | ${fmtDelta(r.deltaVsMain)} |`,
            )
        }
    }

    lines.push("")
    lines.push(
        ...renderABResultsBlock(
            abResults,
            `JSC (Bun / Safari) — ${abResults.length} benchmarks, PR vs <code>main</code> same-VM A/B`,
            true,
        ),
    )

    const nodeBenches = nodeRaw.filter(r => r.tag !== "baseline")
    if (nodeBenches.length > 0) {
        lines.push("")
        lines.push(
            ...renderInfoNodeBlock(
                nodeRaw,
                `V8 (Node.js / Chrome) — ${nodeBenches.length} benchmarks · informational, PR-only`,
            ),
        )
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
            const patchUrl = `https://api.github.com/repos/${repo}/issues/comments/${existing.id}`
            const patchRes = await fetch(patchUrl, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ body }),
            })
            if (!patchRes.ok) {
                console.warn(`Failed to update PR comment (${patchRes.status})`)
            } else {
                console.log(`Updated existing PR comment #${existing.id}`)
            }
        } else {
            const postRes = await fetch(baseUrl, {
                method: "POST",
                headers,
                body: JSON.stringify({ body }),
            })
            if (!postRes.ok) {
                console.warn(`Failed to post PR comment (${postRes.status})`)
            } else {
                console.log("Posted new PR comment")
            }
        }
    } catch (err) {
        console.warn("Failed to post/update PR comment — skipping.", err)
    }
}

// ── Main ───────────────────────────────────────────────────────────────────

/**
 * Reduce the K rounds the orchestrator produced per benchmark down to one
 * row holding the MINIMUM valdres and minimum jotai timing across rounds.
 * The fastest run is the least-contended — closest to the true CPU floor —
 * and the floor is far stabler across noisy shared CI runners than any
 * single run or the median. valdres and jotai minima are taken independently
 * (the gate only uses valdres; jotai is the orientation column).
 */
function minByName(rows: NdjsonResult[]): NdjsonResult[] {
    const byName = new Map<string, NdjsonResult>()
    for (const r of rows) {
        const cur = byName.get(r.name)
        if (!cur) {
            byName.set(r.name, { ...r })
            continue
        }
        cur.valdres = Math.min(cur.valdres, r.valdres)
        if (r.jotai > 0) {
            cur.jotai = cur.jotai > 0 ? Math.min(cur.jotai, r.jotai) : r.jotai
        }
    }
    return [...byName.values()]
}

async function runABMode(
    pr: NdjsonResult[],
    main: NdjsonResult[],
    node: NdjsonResult[],
): Promise<void> {
    // Collapse the K measurement rounds per side to per-benchmark minima.
    const prMin = minByName(pr)
    const mainMin = minByName(main)
    const prBench = prMin.filter(r => r.tag !== "baseline")
    const mainBench = mainMin.filter(r => r.tag !== "baseline")
    const roundsPr = pr.length / Math.max(1, prMin.length)
    console.log(
        `A/B mode: ${prBench.length} PR benchmarks vs ${mainBench.length} main benchmarks` +
            ` (~${roundsPr.toFixed(0)} rounds/side, gating on per-bench minima)`,
    )

    const abResults = compareAB(prMin, mainMin)
    console.log("\n" + formatABTable(abResults, node, 0) + "\n")

    await postOrUpdateComment(runNumber =>
        formatABTable(abResults, node, runNumber),
    )

    const regressions = abResults.filter(r => r.status === "regression")
    if (regressions.length > 0) {
        console.error(
            `❌ ${regressions.length} benchmark regression(s) detected vs main`,
        )
        process.exit(1)
    }
    console.log("✅ No benchmark regressions detected")
}

async function main() {
    const current = readBenchResults(BUN_NDJSON_PATH)
    const nodeCurrent = readBenchResults(NODE_NDJSON_PATH)
    const benchmarks = current.filter(r => r.tag !== "baseline")
    console.log(
        `Read ${current.length} Bun results (${benchmarks.length} comparison benchmarks, ${current.length - benchmarks.length} baselines skipped)`,
    )
    if (nodeCurrent.length > 0) {
        console.log(
            `Read ${nodeCurrent.length} Node/V8 results (informational)`,
        )
    }

    // Same-runner A/B mode: when the orchestrator has produced a main-side
    // ndjson, prefer it over the historical baseline. Falls through to the
    // legacy path when running locally or on a `main` push.
    const mainResults = readBenchResults(MAIN_BUN_NDJSON_PATH)
    if (mainResults.length > 0) {
        console.log(
            `Found ${mainResults.length} main-side results at ${MAIN_BUN_NDJSON_PATH} — using A/B mode`,
        )
        await runABMode(current, mainResults, nodeCurrent)
        return
    }

    const history = await loadHistory()
    if (!history) {
        console.log("No historical data found — skipping regression check.")
        process.exit(0)
    }

    if (history.bun.medianRatios.size === 0) {
        console.log(
            "No historical ratio data found — skipping regression check.",
        )
        process.exit(0)
    }

    const bunWindowUsed = Math.min(history.bun.entryCount, WINDOW_SIZE)
    console.log(
        `Found ${history.bun.entryCount} historical runs on ${history.bun.source} (using last ${bunWindowUsed})`,
    )

    // Log per-benchmark CV and dynamic thresholds (Bun only — gates regressions)
    for (const [name, cv] of history.bun.ratioCvByName) {
        const thresh = dynamicThreshold(cv)
        console.log(
            `  ${name}: ratio CV=${(cv * 100).toFixed(1)}% → threshold=${((thresh - 1) * 100).toFixed(0)}%`,
        )
    }

    const results = compare(current, history.bun)

    // Compare V8 results against V8 history when available. If there's no V8
    // history yet (older entries pre-date this tracking), still render the V8
    // table — every entry just shows up as "new".
    const nodeResults: Comparison[] | null =
        nodeCurrent.length > 0
            ? compare(
                  nodeCurrent,
                  history.node ?? {
                      medianRatios: new Map(),
                      ratioCvByName: new Map(),
                      medianValdres: new Map(),
                      source: "benchmark-data",
                      entryCount: 0,
                  },
              )
            : null
    const nodeWindowUsed = history.node
        ? Math.min(history.node.entryCount, WINDOW_SIZE)
        : 0
    if (history.node) {
        console.log(
            `Found ${history.node.entryCount} V8 historical runs (using last ${nodeWindowUsed})`,
        )
    } else if (nodeCurrent.length > 0) {
        console.log("No V8 historical data yet — V8 section will show all as new")
    }

    console.log(
        "\n" +
            formatTable(results, nodeResults, nodeWindowUsed, 0, bunWindowUsed) +
            "\n",
    )

    await postOrUpdateComment(runNumber =>
        formatTable(
            results,
            nodeResults,
            nodeWindowUsed,
            runNumber,
            bunWindowUsed,
        ),
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
