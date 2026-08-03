import { describe, expect, test } from "bun:test"
import {
    LOCATION_ESTIMATORS,
    benjaminiHochberg,
    hodgesLehmann,
    mean,
    studentTQuantile,
    studentTUpperTail,
    trimCount,
    trimmedMean,
    winsorize,
    winsorizedStandardError,
    type LocationEstimatorName,
} from "./robust-estimators"

describe("location estimators", () => {
    test("Hodges-Lehmann is the median of the Walsh averages", () => {
        expect(hodgesLehmann([1, 2, 3, 4])).toBe(2.5)
        expect(hodgesLehmann([5])).toBe(5)
        // (1+1)/2, (1+9)/2, (9+9)/2 -> [1, 5, 9]
        expect(hodgesLehmann([1, 9])).toBe(5)
    })

    test("the trimmed mean drops whole observations per tail", () => {
        expect(trimCount(4, 0.2)).toBe(0)
        expect(trimCount(8, 0.2)).toBe(1)
        expect(trimCount(12, 0.2)).toBe(2)
        expect(trimmedMean([1, 2, 3, 4, 100], 0.2)).toBe(3)
        expect(trimmedMean([1, 2, 3, 4], 0.2)).toBe(mean([1, 2, 3, 4]))
    })

    test("winsorizing replaces tails rather than removing them", () => {
        expect(winsorize([1, 2, 3, 4, 100], 1)).toEqual([2, 2, 3, 4, 4])
        expect(winsorize([3, 1, 2], 0)).toEqual([1, 2, 3])
    })
})

describe("Yuen standard error", () => {
    test("collapses to s/sqrt(n) when nothing is trimmed", () => {
        const values = [1, 2, 3, 4, 8]
        const center = mean(values)
        const s = Math.sqrt(
            values.reduce((sum, v) => sum + (v - center) ** 2, 0) /
                (values.length - 1),
        )
        expect(winsorizedStandardError(values, 0)).toBeCloseTo(
            s / Math.sqrt(values.length),
            12,
        )
    })

    test("trimming shrinks the effect of one wild value", () => {
        const contaminated = [1, 1, 1, 1, 1, 1, 1, 40]
        expect(winsorizedStandardError(contaminated, 1)).toBeLessThan(
            winsorizedStandardError(contaminated, 0) / 10,
        )
    })

    test("refuses to report a standard error it cannot compute", () => {
        expect(() => winsorizedStandardError([1, 2, 3], 1)).toThrow(
            "at least two untrimmed values",
        )
    })
})

describe("Student-t tail", () => {
    test("matches published critical values", () => {
        expect(studentTUpperTail(2.353, 3)).toBeCloseTo(0.05, 4)
        expect(studentTUpperTail(3.182, 3)).toBeCloseTo(0.025, 4)
        expect(studentTUpperTail(2.015, 5)).toBeCloseTo(0.05, 4)
        expect(studentTUpperTail(1.96, 100000)).toBeCloseTo(0.025, 4)
    })

    test("is symmetric about zero", () => {
        expect(studentTUpperTail(0, 7)).toBeCloseTo(0.5, 12)
        expect(studentTUpperTail(-1.5, 7)).toBeCloseTo(
            1 - studentTUpperTail(1.5, 7),
            12,
        )
    })

    test("the quantile inverts the tail", () => {
        for (const df of [1, 3, 5, 7, 30]) {
            for (const tail of [0.05, 0.01, 0.0025]) {
                expect(
                    studentTUpperTail(studentTQuantile(tail, df), df),
                ).toBeCloseTo(tail, 8)
            }
        }
    })
})

describe("Benjamini-Hochberg", () => {
    test("returns adjusted p-values in input order", () => {
        const adjusted = benjaminiHochberg([0.04, 0.01, 0.03, 0.02, 0.05])
        expect(adjusted).toEqual([0.05, 0.05, 0.05, 0.05, 0.05])
    })

    test("is monotone and bounded by 1", () => {
        const adjusted = benjaminiHochberg([0.001, 0.5, 0.9, 0.95])
        expect(adjusted[0]).toBeCloseTo(0.004, 12)
        expect(adjusted.every(q => q <= 1)).toBe(true)
        expect(adjusted[1]).toBeLessThanOrEqual(adjusted[2])
    })

    test("a lone comparison is unadjusted", () => {
        expect(benjaminiHochberg([0.013])).toEqual([0.013])
    })

    test("handles an empty family", () => {
        expect(benjaminiHochberg([])).toEqual([])
    })
})

/**
 * Why the model defaults to Hodges-Lehmann.
 *
 * The choice is between three candidates on the two properties that decide a
 * benchmark verdict: how far the estimate moves when one pair is contaminated
 * (a CI stall only ever makes a sample slower, so this bias is one-directional
 * and accumulates against us), and how much it scatters on clean data (which
 * sets how many pairs the rerun ladder has to buy). The assertions below are
 * the measurement, not a restatement of the conclusion.
 */
describe("estimator selection", () => {
    function lcg(seed: number): () => number {
        let state = seed >>> 0
        return () => {
            state = (state * 1664525 + 1013904223) >>> 0
            return (state / 0x100000000) * 2 - 1
        }
    }

    const NAMES: LocationEstimatorName[] = [
        "mean",
        "median",
        "hodges-lehmann",
        "trimmed-mean-20",
    ]

    /** RMSE of each estimator against a known truth over many seeds. */
    function rmse(
        pairs: number,
        jitter: number,
        contaminate: number | null,
    ): Record<LocationEstimatorName, number> {
        const totals = Object.fromEntries(
            NAMES.map(name => [name, 0]),
        ) as Record<LocationEstimatorName, number>
        const trials = 400
        for (let seed = 1; seed <= trials; seed++) {
            const noise = lcg(seed * 7919)
            const values = Array.from({ length: pairs }, () => jitter * noise())
            if (contaminate !== null) values[pairs - 1] += Math.log(contaminate)
            for (const name of NAMES) {
                totals[name] += LOCATION_ESTIMATORS[name](values) ** 2
            }
        }
        return Object.fromEntries(
            NAMES.map(name => [name, Math.sqrt(totals[name] / trials)]),
        ) as Record<LocationEstimatorName, number>
    }

    test("one stalled pair in four drags the mean far more than the robust estimators", () => {
        const error = rmse(4, 0.02, 2.5)
        expect(error.mean).toBeGreaterThan(0.2)
        expect(error["hodges-lehmann"]).toBeLessThan(0.03)
        expect(error.median).toBeLessThan(0.03)
        // A 20% trim removes nothing at four values, so it IS the mean here —
        // which is precisely why the model cannot default to it.
        expect(error["trimmed-mean-20"]).toBeCloseTo(error.mean, 12)
    })

    test("on clean data Hodges-Lehmann scatters less than the median", () => {
        const error = rmse(8, 0.03, null)
        expect(error["hodges-lehmann"]).toBeLessThan(error.median)
        // ...while staying close to the efficient-but-fragile mean.
        expect(error["hodges-lehmann"]).toBeLessThan(error.mean * 1.15)
    })

    test("Hodges-Lehmann is the only candidate that wins on both counts", () => {
        const contaminated = rmse(4, 0.02, 2.5)
        const clean = rmse(8, 0.03, null)
        const winners = NAMES.filter(
            name =>
                contaminated[name] <= contaminated["hodges-lehmann"] * 1.01 &&
                clean[name] <= clean["hodges-lehmann"] * 1.01,
        )
        expect(winners).toEqual(["hodges-lehmann"])
    })
})
