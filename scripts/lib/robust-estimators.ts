/**
 * Deterministic robust statistics for the paired benchmark decision model
 * (see scripts/lib/paired-decision.ts).
 *
 * Everything here is a pure function of its input array — no RNG, no clock — so
 * a CI verdict can be reproduced exactly from the uploaded observation NDJSON.
 * That rules out bootstrap intervals; the interval machinery below is the
 * Winsorized (Yuen) standard error plus an exact Student-t tail, which needs no
 * resampling.
 */
import { median } from "./median"

export type LocationEstimator = (values: number[]) => number

function requireValues(values: number[], caller: string): void {
    if (values.length === 0) {
        throw new Error(`${caller} requires at least one value`)
    }
    if (values.some(value => !Number.isFinite(value))) {
        throw new Error(`${caller} requires finite values`)
    }
}

/**
 * Arithmetic mean. Kept as the non-robust reference in the estimator
 * comparison: one contaminated pair moves it by 1/n of the contamination, which
 * is exactly the failure mode the paired gate has to survive.
 */
export function mean(values: number[]): number {
    requireValues(values, "mean")
    return values.reduce((sum, value) => sum + value, 0) / values.length
}

/**
 * Hodges-Lehmann location: the median of the n(n+1)/2 Walsh averages
 * (xi + xj)/2 for i <= j.
 *
 * Breakdown point ~29% and asymptotic efficiency 3/pi (~95.5%) against the mean
 * at the normal. That combination is what this application needs: it absorbs a
 * single stalled pair out of four while staying nearly as sharp as the mean on
 * clean data, where the plain median gives up ~36% efficiency.
 */
export function hodgesLehmann(values: number[]): number {
    requireValues(values, "hodgesLehmann")
    const walsh: number[] = []
    for (let i = 0; i < values.length; i++) {
        for (let j = i; j < values.length; j++) {
            walsh.push((values[i] + values[j]) / 2)
        }
    }
    return median(walsh)
}

/**
 * Hodges-Lehmann has variance pi/3 times the mean's at the normal, so reusing
 * the mean-shaped Yuen standard error would understate it by ~2.3%. Inflating
 * by sqrt(pi/3) keeps the interval honest on clean data; under contamination —
 * the case that matters — the correction is swamped by how much less HL moves.
 */
export const HODGES_LEHMANN_SE_INFLATION = Math.sqrt(Math.PI / 3)

/** Number of observations trimmed from EACH tail at the given fraction. */
export function trimCount(count: number, trimFraction: number): number {
    if (trimFraction < 0 || trimFraction >= 0.5) {
        throw new Error("trimFraction must be in [0, 0.5)")
    }
    return Math.floor(trimFraction * count)
}

/** Symmetric trimmed mean; equals `mean` when the trim count rounds to zero. */
export function trimmedMean(values: number[], trimFraction: number): number {
    requireValues(values, "trimmedMean")
    const g = trimCount(values.length, trimFraction)
    const sorted = [...values].sort((a, b) => a - b)
    return mean(sorted.slice(g, sorted.length - g))
}

/** Replace the g smallest and g largest values with their nearest survivor. */
export function winsorize(values: number[], g: number): number[] {
    requireValues(values, "winsorize")
    const sorted = [...values].sort((a, b) => a - b)
    if (g <= 0) return sorted
    const low = sorted[g]
    const high = sorted[sorted.length - 1 - g]
    return sorted.map((value, index) =>
        index < g ? low : index >= sorted.length - g ? high : value,
    )
}

/**
 * Yuen's standard error for a symmetrically trimmed location estimate:
 *
 *     SE = sqrt( SSD_winsorized / (h * (h - 1)) ),  h = n - 2g
 *
 * At g = 0 this collapses exactly to s / sqrt(n), so the small-n path (four
 * pairs trims nothing at a 20% fraction) is the ordinary standard error and
 * only larger pair counts pay for robustness.
 */
export function winsorizedStandardError(values: number[], g: number): number {
    requireValues(values, "winsorizedStandardError")
    const h = values.length - 2 * g
    if (h < 2) {
        throw new Error(
            "winsorizedStandardError requires at least two untrimmed values",
        )
    }
    const w = winsorize(values, g)
    const center = mean(w)
    const ssd = w.reduce((sum, value) => sum + (value - center) ** 2, 0)
    return Math.sqrt(ssd / (h * (h - 1)))
}

/** Residual degrees of freedom for the Yuen standard error above. */
export function trimmedDegreesOfFreedom(count: number, g: number): number {
    return count - 2 * g - 1
}

// --- Student-t tail ---------------------------------------------------------
// Implemented from the regularized incomplete beta so no probability table or
// dependency is needed and the same code answers every (t, df) the ladder can
// produce.

const LANCZOS = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
]

function lnGamma(x: number): number {
    if (x < 0.5) {
        return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x)
    }
    const z = x - 1
    let a = 0.99999999999980993
    for (let i = 0; i < LANCZOS.length; i++) a += LANCZOS[i] / (z + i + 1)
    const t = z + LANCZOS.length - 0.5
    return (
        0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a)
    )
}

/** Lentz continued fraction for the incomplete beta (Numerical Recipes 6.4). */
function betaContinuedFraction(a: number, b: number, x: number): number {
    const tiny = 1e-30
    const qab = a + b
    const qap = a + 1
    const qam = a - 1
    let c = 1
    let d = 1 - (qab * x) / qap
    if (Math.abs(d) < tiny) d = tiny
    d = 1 / d
    let h = d
    for (let m = 1; m <= 300; m++) {
        const m2 = 2 * m
        let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
        d = 1 + aa * d
        if (Math.abs(d) < tiny) d = tiny
        c = 1 + aa / c
        if (Math.abs(c) < tiny) c = tiny
        d = 1 / d
        h *= d * c
        aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
        d = 1 + aa * d
        if (Math.abs(d) < tiny) d = tiny
        c = 1 + aa / c
        if (Math.abs(c) < tiny) c = tiny
        d = 1 / d
        const delta = d * c
        h *= delta
        if (Math.abs(delta - 1) < 3e-16) break
    }
    return h
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
    if (x <= 0) return 0
    if (x >= 1) return 1
    const front =
        lnGamma(a + b) -
        lnGamma(a) -
        lnGamma(b) +
        a * Math.log(x) +
        b * Math.log1p(-x)
    return x < (a + 1) / (a + b + 2)
        ? (Math.exp(front) * betaContinuedFraction(a, b, x)) / a
        : 1 - (Math.exp(front) * betaContinuedFraction(b, a, 1 - x)) / b
}

/** P(T > t) for Student's t with `df` degrees of freedom. */
export function studentTUpperTail(t: number, df: number): number {
    if (df < 1) throw new Error("studentTUpperTail requires df >= 1")
    if (!Number.isFinite(t)) return t > 0 ? 0 : 1
    const tail = 0.5 * regularizedIncompleteBeta(df / (df + t * t), df / 2, 0.5)
    return t >= 0 ? tail : 1 - tail
}

/** The t with P(T > t) = upperTail, by bisection on the monotone tail. */
export function studentTQuantile(upperTail: number, df: number): number {
    if (upperTail <= 0 || upperTail >= 1) {
        throw new Error("studentTQuantile requires 0 < upperTail < 1")
    }
    let low = -1e6
    let high = 1e6
    for (let i = 0; i < 200; i++) {
        const mid = (low + high) / 2
        if (studentTUpperTail(mid, df) > upperTail) low = mid
        else high = mid
    }
    return (low + high) / 2
}

/**
 * Benjamini-Hochberg adjusted p-values (q-values), returned in input order.
 * Controls the false discovery rate across the comparison family rather than
 * the family-wise error rate: with tens of benchmarks per runtime, Bonferroni
 * would need evidence no four-pair measurement can produce.
 */
export function benjaminiHochberg(pValues: number[]): number[] {
    const m = pValues.length
    if (m === 0) return []
    const order = pValues
        .map((p, index) => ({ p, index }))
        .sort((a, b) => a.p - b.p)
    const adjusted = new Array<number>(m)
    let running = 1
    for (let rank = m; rank >= 1; rank--) {
        const { p, index } = order[rank - 1]
        running = Math.min(running, (m / rank) * p)
        adjusted[index] = Math.min(1, running)
    }
    return adjusted
}

export const LOCATION_ESTIMATORS = {
    mean,
    median,
    "hodges-lehmann": hodgesLehmann,
    "trimmed-mean-20": (values: number[]) => trimmedMean(values, 0.2),
} satisfies Record<string, LocationEstimator>

export type LocationEstimatorName = keyof typeof LOCATION_ESTIMATORS
