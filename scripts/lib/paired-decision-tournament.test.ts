import { describe, expect, test } from "bun:test"
import { DEFAULT_PAIRED_POLICY } from "./paired-decision"
import {
    decideTournament,
    nearestRank,
    ordinaryMedian,
    type TournamentLane,
} from "./paired-decision-tournament"
const lane = (
    ratio = 1,
    pairs = 24,
    extra: Partial<TournamentLane> = {},
): TournamentLane => ({
    id: "calibration",
    runtime: "node",
    core: pairs === 50,
    intended: false,
    samples: Array.from({ length: pairs }, (_, i) => ({
        pairId: String(i),
        baseNs: 100000 + i * 37,
        headNs: (100000 + i * 37) * ratio,
    })),
    ...extra,
})
describe("tournament policy calibration without changing PR defaults", () => {
    test("A/A demonstrates non-regression and never manufactures an intended win", () => {
        for (const n of [8, 24, 50]) {
            const stage = n === 8 ? "C" : "A"
            const aa = decideTournament([lane(1, n)], stage, { control: true })
            expect(aa.performanceStatus).toBe("pass")
            expect(aa.intendedWinRequired).toBe(false)
            const declared = decideTournament(
                [lane(1, n, { intended: true })],
                stage,
            )
            expect(declared.performanceStatus).toBe("inconclusive")
            expect(declared.intendedWinEstablished).toBe(false)
        }
    })
    test.each([1.15, 1.2])(
        "injected %s regression fails protected A budget",
        ratio => {
            const result = decideTournament([lane(ratio)], "A")
            expect(result.performanceStatus).toBe("fail")
            expect(
                result.rows[0]!.decisions.protectedNonRegression!.qValue,
            ).toBeGreaterThan(0.95)
        },
    )
    test("intended 15% gain crosses only the declared family and its own null", () => {
        const result = decideTournament(
            [
                lane(0.85, 24, { id: "intended", intended: true }),
                lane(1, 24, { id: "ordinary" }),
            ],
            "A",
        )
        expect(result.performanceStatus).toBe("pass")
        expect(result.rows[0]!.decisions.intendedWin).toMatchObject({
            nullRatio: 1,
            status: "pass",
        })
        expect(result.rows[1]!.decisions.intendedWin).toBeNull()
        expect(
            result.rows.every(
                r => r.decisions.protectedNonRegression?.nullRatio === 1.1,
            ),
        ).toBe(true)
    })
    test("bimodal and boundary data remain inconclusive", () => {
        const mixed = lane()
        mixed.samples.forEach((s, i) => {
            if (i % 2) s.headNs *= 1.6
        })
        const result = decideTournament([mixed], "A")
        expect(result.rows[0]!.flags).toContain("bimodal")
        expect(result.rows[0]!.nonRegression).toBe("inconclusive")
        expect(decideTournament([lane(1.1)], "A").rows[0]!.nonRegression).toBe(
            "inconclusive",
        )
    })
    test("p95 is nearest rank and is protected independently of the location", () => {
        expect(ordinaryMedian([1, 2, 3, 4])).toBe(2.5)
        expect(nearestRank([1, 2, 3, 4], 0.95)).toBe(4)
        const input = lane()
        input.samples.slice(-2).forEach(s => (s.headNs *= 1.5))
        const result = decideTournament([input], "A")
        expect(result.rows[0]!.nonRegression).toBe("pass")
        expect(result.rows[0]!.tail).toBe("fail")
    })
    test("fixed samples, finite durations and exact pairing fail closed", () => {
        expect(() => decideTournament([lane(1, 23)], "A")).toThrow(
            "STATS-PAIRS",
        )
        expect(() =>
            decideTournament([lane(1, 24, { unpairedHead: 1 })], "A"),
        ).toThrow("STATS-PAIRS")
        const bad = lane()
        bad.samples[0]!.headNs = NaN
        expect(() => decideTournament([bad], "A")).toThrow("STATS-SAMPLE")
        const dup = lane()
        dup.samples[1]!.pairId = dup.samples[0]!.pairId
        expect(() => decideTournament([dup], "A")).toThrow("STATS-PAIRS")
    })
    test("separate BH families agree with hand calculated membership", () => {
        const rows = Array.from({ length: 31 }, (_, i) =>
            lane(i === 0 ? 0.8 : 1, 24, { id: `lane${i}`, intended: i === 0 }),
        )
        const full = decideTournament(rows, "A")
        const alone = decideTournament([rows[0]!], "A")
        expect(full.rows[0]!.decisions.intendedWin!.qValue).toBe(
            alone.rows[0]!.decisions.intendedWin!.qValue,
        )
        expect(
            full.rows.filter(r => r.decisions.protectedNonRegression !== null),
        ).toHaveLength(31)
    })
    test("deterministic null simulations do not invent 15% gains", () => {
        let random = 0x5eed
        const next = () => {
            random = (Math.imul(random, 1664525) + 1013904223) >>> 0
            return random / 2 ** 32
        }
        for (let run = 0; run < 300; run++) {
            const input = lane(1, 24, { intended: true })
            input.samples.forEach(s => {
                s.baseNs *= 0.98 + 0.04 * next()
                s.headNs *= 0.98 + 0.04 * next()
            })
            expect(decideTournament([input], "A").intendedWinEstablished).toBe(
                false,
            )
        }
    })
    test("existing PR policy defaults are unchanged", () =>
        expect(DEFAULT_PAIRED_POLICY).toMatchObject({
            budgetPct: 0.1,
            minPairs: 4,
            falseDiscoveryRate: 0.05,
            estimator: "hodges-lehmann",
        }))
})

test("significant gains smaller than 15% do not establish the intended gate", () => {
    const result = decideTournament([lane(0.9, 24, { intended: true })], "A")
    expect(result.rows[0]!.decisions.intendedWin!.qValue).toBeLessThan(0.05)
    expect(result.intendedWinEstablished).toBe(false)
    expect(result.performanceStatus).toBe("inconclusive")
})
test("C screening makes no BH claim and uses its separate 20% ordinary ceiling", () => {
    const result = decideTournament(
        [lane(0.8, 8, { intended: true }), lane(1.15, 8, { id: "ordinary" })],
        "C",
    )
    expect(result.performanceStatus).toBe("pass")
    expect(
        result.rows.every(
            row =>
                row.decisions.protectedNonRegression === null &&
                row.decisions.intendedWin === null,
        ),
    ).toBe(true)
})
