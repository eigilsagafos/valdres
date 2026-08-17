import { describe, expect, test } from "bun:test"
import { settleTier, toBenchmarkObservation } from "./bench-utils"
import { parseBenchmarkObservation } from "./benchmark-result-schema"

const window = (p50: number) => ({ p50 })

/** Returns each queued window in order and counts how many were measured. */
const windowQueue = (p50s: number[]) => {
    let calls = 0
    const nextWindow = async () => {
        if (calls >= p50s.length) throw new Error("measured past the queue")
        return window(p50s[calls++])
    }
    return { nextWindow, calls: () => calls }
}

describe("settleTier", () => {
    test("settles on the second window when it agrees with the first", async () => {
        const queue = windowQueue([1_010])
        const { stats, tier } = await settleTier(
            window(1_000),
            queue.nextWindow,
        )
        expect(stats.p50).toBe(1_010)
        expect(queue.calls()).toBe(1)
        expect(tier).toEqual({
            tierWindows: 2,
            tierSettled: true,
            tierDiscardedP50s: [1_000],
        })
    })

    test("discards the whole ramp and reports the settled window", async () => {
        const queue = windowQueue([2_000, 1_050, 1_020])
        const { stats, tier } = await settleTier(
            window(4_000),
            queue.nextWindow,
        )
        expect(stats.p50).toBe(1_020)
        expect(tier).toEqual({
            tierWindows: 4,
            tierSettled: true,
            tierDiscardedP50s: [4_000, 2_000, 1_050],
        })
    })

    test("an oscillating process exhausts the five-window cap unsettled", async () => {
        const queue = windowQueue([2_000, 1_000, 2_000, 1_000])
        const { stats, tier } = await settleTier(
            window(1_000),
            queue.nextWindow,
        )
        expect(stats.p50).toBe(1_000)
        expect(queue.calls()).toBe(4)
        expect(tier).toEqual({
            tierWindows: 5,
            tierSettled: false,
            tierDiscardedP50s: [1_000, 2_000, 1_000, 2_000],
        })
    })

    test("agreement is consecutive windows within 5% of a log-ratio, not versus the first", async () => {
        // 1000 → 1051 is |ln| ≈ 0.0497 and settles immediately.
        const near = await settleTier(
            window(1_000),
            windowQueue([1_051]).nextWindow,
        )
        expect(near.tier.tierSettled).toBe(true)
        expect(near.tier.tierWindows).toBe(2)

        // 1000 → 1055 is |ln| ≈ 0.0535: the second window is discarded, and
        // settlement happens when the THIRD window agrees with the second.
        const far = await settleTier(
            window(1_000),
            windowQueue([1_055, 1_055]).nextWindow,
        )
        expect(far.stats.p50).toBe(1_055)
        expect(far.tier).toEqual({
            tierWindows: 3,
            tierSettled: true,
            tierDiscardedP50s: [1_000, 1_055],
        })
    })

    test("diagnostics serialize into a valid observation without raw samples", async () => {
        const { tier } = await settleTier(
            window(4_000),
            windowQueue([2_000, 1_050, 1_020]).nextWindow,
        )
        const stats = {
            p25: 900,
            p50: 1_020,
            p75: 1_100,
            p99: 1_200,
            ticks: 49_152,
            samples: new Array(12).fill(1_020),
        }
        const row = toBenchmarkObservation(
            "async settle: atom resolve observed",
            stats,
            tier,
        )
        expect(parseBenchmarkObservation(row, "settled row")).toEqual(row)
    })
})
