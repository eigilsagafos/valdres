import { expect } from "bun:test"
import { measure } from "mitata"

const MEASURE_OPTS = {
    min_samples: 20,
    min_cpu_time: 1_500 * 1e6,
    warmup_samples: 5,
}

interface TrimmedResult {
    median: number
    cv: number
    kept: number
    total: number
}

function iqrTrimmed(rawSamples: number[]): TrimmedResult {
    if (rawSamples.length === 0) {
        throw new Error("iqrTrimmed: received empty samples array")
    }

    const sorted = [...rawSamples].sort((a, b) => a - b)
    const n = sorted.length

    if (n < 4) {
        const mid = Math.floor(n / 2)
        const median =
            n % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
        return { median, cv: 0, kept: n, total: n }
    }

    const q1 = sorted[Math.floor(n * 0.25)]
    const q3 = sorted[Math.floor(n * 0.75)]
    const iqr = q3 - q1
    const lower = q1 - 1.5 * iqr
    const upper = q3 + 1.5 * iqr
    let filtered = sorted.filter(s => s >= lower && s <= upper)
    if (filtered.length === 0) filtered = sorted

    const mid = Math.floor(filtered.length / 2)
    const median =
        filtered.length % 2 !== 0
            ? filtered[mid]
            : (filtered[mid - 1] + filtered[mid]) / 2

    const mean = filtered.reduce((a, b) => a + b, 0) / filtered.length
    const variance =
        filtered.reduce((a, b) => a + (b - mean) ** 2, 0) / filtered.length
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0

    return { median, cv, kept: filtered.length, total: n }
}

export async function compare(
    name: string,
    valdresFn: () => void,
    svelteFn: () => void,
    maxSlowerRatio: number = 2.0,
) {
    const hash = name.split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
    const runValdresFirst = hash % 2 === 0
    const [firstStats, secondStats] = runValdresFirst
        ? [await measure(valdresFn, MEASURE_OPTS), await measure(svelteFn, MEASURE_OPTS)]
        : [await measure(svelteFn, MEASURE_OPTS), await measure(valdresFn, MEASURE_OPTS)]
    const valdresStats = runValdresFirst ? firstStats : secondStats
    const svelteStats = runValdresFirst ? secondStats : firstStats

    const valdres = iqrTrimmed(valdresStats.samples)
    const svelte = iqrTrimmed(svelteStats.samples)

    const ratio = valdres.median / svelte.median
    const speedup = svelte.median / valdres.median

    const tag =
        ratio <= 1.0
            ? `valdres ${speedup.toFixed(1)}x faster`
            : `svelte ${ratio.toFixed(1)}x faster`

    const trimInfo =
        valdres.kept < valdres.total || svelte.kept < svelte.total
            ? ` [trimmed ${valdres.total - valdres.kept}+${svelte.total - svelte.kept} outliers]`
            : ""

    console.log(
        `  ${name}: valdres=${fmtNs(valdres.median)} svelte=${fmtNs(svelte.median)} (${tag})${trimInfo}`,
    )

    return { name, valdres: valdres.median, svelte: svelte.median, ratio, tag }
}

function fmtNs(ns: number): string {
    if (ns < 1_000) return `${ns.toFixed(0)}ns`
    if (ns < 1_000_000) return `${(ns / 1_000).toFixed(1)}µs`
    return `${(ns / 1_000_000).toFixed(2)}ms`
}
