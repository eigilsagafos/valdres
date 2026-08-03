/**
 * The synthetic corpus for the paired decision model.
 *
 * Every case is a hand-built base/head vector with a known truth, so this file
 * doubles as the model's false-positive / false-negative characterisation. The
 * numbers are deterministic — noise comes from a fixed LCG, never Math.random —
 * so a failure here is a real behaviour change, not a reroll.
 */
import { describe, expect, test } from "bun:test"
import {
    DEFAULT_PAIRED_POLICY,
    decidePairedRun,
    detectBimodality,
    lanesNeedingRerun,
    type PairedComparison,
    type PairedDecision,
    type PairedPolicy,
} from "./paired-decision"

/** Deterministic uniform noise in [-1, 1). */
function lcg(seed: number): () => number {
    let state = seed >>> 0
    return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return (state / 0x100000000) * 2 - 1
    }
}

const BASE_NS = 50_000

interface CaseOptions {
    benchmark?: string
    family?: "protected" | "informational"
    /** True relative effect, e.g. 0.5 for a genuine 50% regression. */
    effect?: number
    /** Relative jitter applied independently to each measurement. */
    jitter?: number
    pairs?: number
    seed?: number
    /** Multiplier applied to specific pair indexes on one side. */
    contaminate?: { side: "base" | "head"; pairs: number[]; factor: number }
    /** Explicit head/base multipliers, one per pair; overrides effect+jitter. */
    ratios?: number[]
    dropHeadPairs?: number[]
    dropBasePairs?: number[]
}

function comparison(options: CaseOptions = {}): PairedComparison {
    const {
        benchmark = "get 1000 atoms / valdres",
        family = "protected",
        effect = 0,
        jitter = 0.01,
        pairs = 4,
        seed = 12345,
        contaminate,
        ratios,
        dropHeadPairs = [],
        dropBasePairs = [],
    } = options
    const noise = lcg(seed)
    const samples = []
    let unpairedBase = 0
    let unpairedHead = 0

    const count = ratios ? ratios.length : pairs
    for (let i = 0; i < count; i++) {
        let baseNs = BASE_NS * (1 + jitter * noise())
        let headNs = ratios
            ? baseNs * ratios[i]
            : BASE_NS * (1 + effect) * (1 + jitter * noise())
        if (contaminate?.pairs.includes(i)) {
            if (contaminate.side === "base") baseNs *= contaminate.factor
            else headNs *= contaminate.factor
        }
        if (dropHeadPairs.includes(i)) {
            unpairedBase++
            continue
        }
        if (dropBasePairs.includes(i)) {
            unpairedHead++
            continue
        }
        samples.push({ pairId: `p${i}`, baseNs, headNs })
    }

    return {
        benchmark,
        runtime: "bun",
        suite: "standard",
        family,
        samples,
        unpairedBase,
        unpairedHead,
    }
}

function decide(
    options: CaseOptions = {},
    policy: PairedPolicy = DEFAULT_PAIRED_POLICY,
): PairedDecision {
    return decidePairedRun([comparison(options)], policy)[0]
}

describe("outcomes", () => {
    test("a clean no-op is demonstrated within budget", () => {
        const decision = decide({ effect: 0, jitter: 0.01, pairs: 8 })
        expect(decision.outcome).toBe("within-budget")
        expect(Math.abs(decision.estimatePct)).toBeLessThan(0.02)
    })

    test("a genuine 50% regression is called at the minimum pair count", () => {
        const decision = decide({ effect: 0.5, pairs: 4 })
        expect(decision.outcome).toBe("regression")
        expect(decision.estimatePct).toBeGreaterThan(0.45)
        expect(decision.estimatePct).toBeLessThan(0.55)
    })

    test("a genuine 15% regression is called on a quiet runner", () => {
        const decision = decide({ effect: 0.15, pairs: 4, jitter: 0.01 })
        expect(decision.outcome).toBe("regression")
    })

    test("a genuine 10% regression sits on the budget and stays undecided", () => {
        // The budget IS +10%, so this is the boundary. Refusing to call it
        // either way is the correct answer, not a miss — and no pair count
        // changes that, because the effect and the boundary coincide.
        expect(decide({ effect: 0.1, pairs: 4 }).outcome).toBe("inconclusive")
        expect(decide({ effect: 0.1, pairs: 12 }).outcome).toBe("inconclusive")
    })

    test("a genuine improvement is within budget and reported negative", () => {
        const decision = decide({ effect: -0.3, pairs: 4 })
        expect(decision.outcome).toBe("within-budget")
        expect(decision.estimatePct).toBeLessThan(-0.25)
    })
})

describe("contamination", () => {
    test("one stalled head pair does not become a regression", () => {
        const decision = decide({
            effect: 0,
            pairs: 4,
            contaminate: { side: "head", pairs: [2], factor: 2.5 },
        })
        expect(decision.outcome).toBe("inconclusive")
        // The robust estimator absorbs the stall; only the interval widens.
        expect(Math.abs(decision.estimatePct)).toBeLessThan(0.03)
    })

    test("one stalled base pair does not become an improvement", () => {
        const decision = decide({
            effect: 0,
            pairs: 4,
            contaminate: { side: "base", pairs: [1], factor: 2.5 },
        })
        expect(decision.outcome).toBe("inconclusive")
        expect(Math.abs(decision.estimatePct)).toBeLessThan(0.03)
    })

    test("a stall on top of a real regression degrades to inconclusive, never to clean", () => {
        const decision = decide({
            effect: 0.5,
            pairs: 4,
            contaminate: { side: "head", pairs: [3], factor: 2 },
        })
        expect(decision.outcome).not.toBe("within-budget")
        expect(decision.estimatePct).toBeGreaterThan(0.4)
    })

    test("the ladder recovers a regression that a stall obscured at four pairs", () => {
        const contaminate = {
            side: "head" as const,
            pairs: [3],
            factor: 2,
        }
        expect(decide({ effect: 0.5, pairs: 4, contaminate }).outcome).toBe(
            "inconclusive",
        )
        expect(decide({ effect: 0.5, pairs: 8, contaminate }).outcome).toBe(
            "regression",
        )
    })
})

describe("bimodal process states", () => {
    // The measurement that motivated this whole model: base 131/131/131 ns
    // against head 351/351/131 ns in one CI job. `min(head/base)` reports it as
    // 0% because one pair happened to be clean.
    const HISTORICAL = { base: [131, 131, 131], head: [351, 351, 131] }

    test("the historical 131/351 vector is flagged, not converted to 0%", () => {
        const decision = decide({
            ratios: HISTORICAL.head.map((h, i) => h / HISTORICAL.base[i]),
            jitter: 0,
        })
        expect(decision.flags).toContain("bimodal")
        expect(decision.outcome).toBe("inconclusive")
        // The old statistic's answer was exactly 0%. Anything near it is the bug.
        expect(decision.estimatePct).toBeGreaterThan(0.5)
    })

    test("min(head/base) is what the model replaces", () => {
        const ratios = HISTORICAL.head.map((h, i) => h / HISTORICAL.base[i])
        expect(Math.min(...ratios)).toBe(1)
    })

    test("two process states split evenly are flagged bimodal", () => {
        const decision = decide({
            ratios: [1.0, 1.0, 1.45, 1.45, 1.0, 1.45],
            jitter: 0.002,
        })
        expect(decision.flags).toContain("bimodal")
        expect(decision.outcome).toBe("inconclusive")
    })

    test("the flag clears once the ladder outvotes the contaminated pairs", () => {
        // Two stalled pairs out of four are two process states; the same two
        // out of twelve are two stalls the robust estimator absorbs. If the
        // guard latched on an absolute count instead, a lane contaminated in
        // round 1 could never be cleared and the ladder would burn every round.
        const stalls = [1.6, 1.6]
        const clean = (count: number) => Array<number>(count).fill(1)
        const four = decide({ ratios: [...stalls, ...clean(2)], jitter: 0.002 })
        const twelve = decide({
            ratios: [...stalls, ...clean(10)],
            jitter: 0.002,
        })
        expect(four.flags).toContain("bimodal")
        expect(four.outcome).toBe("inconclusive")
        expect(twelve.flags).not.toContain("bimodal")
        expect(twelve.outcome).toBe("within-budget")
    })

    test("a single deviant pair is an outlier, not a process state", () => {
        const diagnostic = detectBimodality(
            [0, 0, 0, Math.log(2.5)],
            DEFAULT_PAIRED_POLICY,
        )
        expect(diagnostic.bimodal).toBe(false)
        expect(diagnostic.minorityCount).toBe(1)
    })

    test("a tight cluster pair is not bimodal", () => {
        const decision = decide({ effect: 0.5, pairs: 8, jitter: 0.01 })
        expect(decision.flags).not.toContain("bimodal")
    })
})

describe("ordering and drift", () => {
    // A B-P-P-B block pairs (base@1, head@2) and (head@1, base@2), so a linear
    // drift across the block enters the two pairs with opposite sign.
    function driftBlock(effect: number, driftPerSlot: number) {
        const slots = [0, 1, 2, 3].map(i => 1 + driftPerSlot * i)
        return [
            {
                base: BASE_NS * slots[0],
                head: BASE_NS * (1 + effect) * slots[1],
            },
            {
                base: BASE_NS * slots[3],
                head: BASE_NS * (1 + effect) * slots[2],
            },
        ]
    }

    test("balanced blocks cancel a linear drift", () => {
        const block = driftBlock(0, 0.04)
        const decision = decidePairedRun([
            {
                benchmark: "get 1000 atoms / valdres",
                runtime: "bun",
                suite: "standard",
                family: "protected",
                samples: [...driftBlock(0, 0.04), ...block].map((p, i) => ({
                    pairId: `p${i}`,
                    baseNs: p.base,
                    headNs: p.head,
                })),
                unpairedBase: 0,
                unpairedHead: 0,
            },
        ])[0]
        expect(Math.abs(decision.estimatePct)).toBeLessThan(0.005)
        expect(decision.outcome).toBe("within-budget")
    })

    test("unbalanced base-then-head pairing biases the same drift upward", () => {
        // Every pair measures head one slot later than base, so the drift is
        // indistinguishable from a regression. This is what balancing buys.
        const decision = decide({
            ratios: [1.04, 1.04, 1.04, 1.04],
            jitter: 0,
        })
        expect(decision.estimatePct).toBeGreaterThan(0.03)
    })

    test("alternating drift averages out and never reads as a regression", () => {
        const decision = decide({ ratios: [1.05, 0.95, 1.05, 0.95], jitter: 0 })
        expect(decision.outcome).not.toBe("regression")
        expect(Math.abs(decision.estimatePct)).toBeLessThan(0.005)
    })
})

describe("missing pairs", () => {
    test("dropped head observations are recorded and the rest analysed", () => {
        const decision = decide({ effect: 0.5, pairs: 6, dropHeadPairs: [1] })
        expect(decision.pairs).toBe(5)
        expect(decision.unpairedBase).toBe(1)
        expect(decision.flags).toContain("unpaired-observations")
        expect(decision.outcome).toBe("regression")
    })

    test("too few surviving pairs decide nothing", () => {
        const decision = decide({
            effect: 0.5,
            pairs: 4,
            dropHeadPairs: [0, 1],
        })
        expect(decision.outcome).toBe("inconclusive")
        expect(decision.flags).toContain("insufficient-pairs")
    })

    test("a comparison with no surviving pairs is inconclusive, not a crash", () => {
        const decision = decide({ pairs: 2, dropBasePairs: [0, 1] })
        expect(decision.pairs).toBe(0)
        expect(decision.outcome).toBe("inconclusive")
    })
})

describe("multiple comparisons", () => {
    function suite(count: number, regressed: number[]): PairedComparison[] {
        return Array.from({ length: count }, (_, i) =>
            comparison({
                benchmark: `bench ${i} / valdres`,
                effect: regressed.includes(i) ? 0.5 : 0,
                pairs: 6,
                seed: 1000 + i,
            }),
        )
    }

    test("one true regression among many null comparisons is found", () => {
        const decisions = decidePairedRun(suite(24, [7]))
        const regressions = decisions.filter(d => d.outcome === "regression")
        expect(regressions).toHaveLength(1)
        expect(regressions[0].benchmark).toBe("bench 7 / valdres")
    })

    test("no null comparison is called a regression across the family", () => {
        const decisions = decidePairedRun(suite(40, []))
        expect(decisions.filter(d => d.outcome === "regression")).toHaveLength(
            0,
        )
        expect(
            decisions.filter(d => d.outcome === "within-budget").length,
        ).toBeGreaterThan(30)
    })

    test("adjustment is per family, so informational rows cannot dilute protected ones", () => {
        const protectedRows = suite(4, [1]).map(c => ({
            ...c,
            family: "protected" as const,
        }))
        const informational = suite(60, []).map(c => ({
            ...c,
            benchmark: `${c.benchmark} info`,
            family: "informational" as const,
        }))
        const decisions = decidePairedRun([...protectedRows, ...informational])
        const hit = decisions.find(d => d.benchmark === "bench 1 / valdres")!
        expect(hit.outcome).toBe("regression")
        expect(hit.family).toBe("protected")
    })

    test("q-values grow with family size", () => {
        const small = decidePairedRun(suite(4, [0]))[0]
        const large = decidePairedRun(suite(60, [0]))[0]
        expect(large.regressionQ).toBeGreaterThan(small.regressionQ)
    })
})

/**
 * Operating characteristics under a realistic family (22 protected comparisons
 * = 11 benchmarks x 2 runtimes) with one true effect embedded in nulls. The
 * matrix these assertions summarise is reproduced in
 * scripts/PAIRED_DECISION_MODEL.md.
 */
describe("characterisation", () => {
    const FAMILY = 22

    function family(effect: number, jitter: number, pairs: number) {
        return [
            comparison({
                benchmark: "target / valdres",
                effect,
                jitter,
                pairs,
                seed: 7,
            }),
            ...Array.from({ length: FAMILY - 1 }, (_, i) =>
                comparison({
                    benchmark: `null ${i} / valdres`,
                    effect: 0,
                    jitter,
                    pairs,
                    seed: 100 + i,
                }),
            ),
        ]
    }

    function target(effect: number, jitter: number, pairs: number) {
        return decidePairedRun(family(effect, jitter, pairs))[0].outcome
    }

    // The ladder's real steps: one round is two B-P-P-B blocks = 4 pairs, and
    // the Yuen degrees of freedom go 3 -> 5 -> 7 across them.
    const LADDER = [4, 8, 12]

    test("no false regression on a quiet or a noisy runner", () => {
        for (const jitter of [0.01, 0.03, 0.06]) {
            for (const pairs of LADDER) {
                const decisions = decidePairedRun(family(0, jitter, pairs))
                expect(
                    decisions.filter(d => d.outcome === "regression"),
                ).toHaveLength(0)
            }
        }
    })

    test("a catastrophic 50% regression is caught at every rung and jitter", () => {
        for (const jitter of [0.01, 0.03, 0.06]) {
            for (const pairs of LADDER) {
                expect(target(0.5, jitter, pairs)).toBe("regression")
            }
        }
    })

    test("a genuine improvement is never mistaken for a regression", () => {
        for (const jitter of [0.01, 0.03, 0.06]) {
            for (const pairs of LADDER) {
                expect(target(-0.3, jitter, pairs)).toBe("within-budget")
            }
        }
    })

    test("detection improves monotonically as the ladder adds pairs", () => {
        // At +3% jitter a 15% regression needs the full ladder; a 20% one
        // resolves a rung earlier. Neither is ever called backwards.
        expect(LADDER.map(pairs => target(0.15, 0.03, pairs))).toEqual([
            "inconclusive",
            "inconclusive",
            "regression",
        ])
        expect(LADDER.map(pairs => target(0.2, 0.03, pairs))).toEqual([
            "inconclusive",
            "regression",
            "regression",
        ])
    })

    test("a noisy runner degrades to inconclusive, never to a wrong call", () => {
        const decisions = decidePairedRun(family(0, 0.12, 4))
        expect(decisions.filter(d => d.outcome === "regression")).toHaveLength(
            0,
        )
        // With this much noise the model should also decline to certify.
        expect(
            decisions.filter(d => d.outcome === "inconclusive").length,
        ).toBeGreaterThan(0)
    })

    /**
     * Type-I error measured where it is actually hard: with the true effect
     * sitting exactly ON the +10% budget, so every `regression` verdict is a
     * false one. Testing at effect 0 instead — 10 points away from the
     * boundary — reports 0% everywhere and proves nothing.
     *
     * The ladder is simulated faithfully: twelve pairs are drawn once per row
     * and round r analyses the first 4r of them, so the looks are nested the
     * way the workflow's reruns are. The rates asserted here are the ones
     * quoted in PAIRED_DECISION_MODEL.md.
     */
    describe("type-I error at the budget boundary", () => {
        const TRIALS = 200

        function boundaryTrial(seed: number, jitter: number) {
            const rows = Array.from({ length: FAMILY }, (_, i) => {
                const noise = lcg(seed * 7919 + i * 131)
                return Array.from({ length: 12 }, (_, p) => ({
                    pairId: `p${p}`,
                    baseNs: BASE_NS * (1 + jitter * noise()),
                    headNs:
                        BASE_NS *
                        (1 + DEFAULT_PAIRED_POLICY.budgetPct) *
                        (1 + jitter * noise()),
                }))
            })
            let decisions: PairedDecision[] = []
            for (const round of [1, 2, 3]) {
                decisions = decidePairedRun(
                    rows.map((samples, i) => ({
                        benchmark: `b${i} / valdres`,
                        runtime: "bun",
                        suite: "standard",
                        family: "protected" as const,
                        samples: samples.slice(0, round * 4),
                        unpairedBase: 0,
                        unpairedHead: 0,
                    })),
                )
                if (lanesNeedingRerun(decisions).length === 0) break
            }
            return decisions
        }

        function falseRegressionRate(jitter: number) {
            let falseCalls = 0
            let comparisons = 0
            let jobs = 0
            for (let seed = 1; seed <= TRIALS; seed++) {
                let hit = false
                for (const decision of boundaryTrial(seed, jitter)) {
                    comparisons++
                    if (decision.outcome === "regression") {
                        falseCalls++
                        hit = true
                    }
                }
                if (hit) jobs++
            }
            return {
                perComparison: falseCalls / comparisons,
                perJob: jobs / TRIALS,
            }
        }

        test("stays far below the nominal 5% FDR at every jitter level", () => {
            for (const jitter of [0.01, 0.03, 0.06, 0.12]) {
                const { perComparison } = falseRegressionRate(jitter)
                expect(perComparison).toBeLessThan(
                    DEFAULT_PAIRED_POLICY.falseDiscoveryRate,
                )
                // Conservative by more than an order of magnitude, which is the
                // evidence that the studentized approximation is not inflating
                // error rates for this design. Tighten if this ever drifts up.
                expect(perComparison).toBeLessThan(0.005)
            }
        })

        test("a quiet runner produces no false blocks at all", () => {
            expect(falseRegressionRate(0.01).perComparison).toBe(0)
        })

        test("exact sign-flip inference is not viable at these pair counts", () => {
            // Records why the model studentizes instead of using an exact
            // permutation test. A paired sign-flip test on n pairs cannot
            // produce a one-sided p below 2^-n, and BH over the protected
            // family needs the smallest p to clear q/m. At four and eight pairs
            // no measurement, however extreme, could ever be called — the
            // ladder's first two rungs would be structurally blind.
            const m = FAMILY
            const threshold = DEFAULT_PAIRED_POLICY.falseDiscoveryRate / m
            expect(2 ** -4).toBeGreaterThan(threshold)
            expect(2 ** -8).toBeGreaterThan(threshold)
            expect(2 ** -12).toBeLessThan(threshold)
        })

        test("per-job false-block rate is bounded on a noisy runner", () => {
            // The number an engineer feels: fraction of PR jobs where at least
            // one protected row is falsely called. This is the headline input
            // to any future blocking decision.
            expect(falseRegressionRate(0.06).perJob).toBeLessThan(0.1)
            expect(falseRegressionRate(0.12).perJob).toBeLessThan(0.1)
        })
    })
})

describe("rerun ladder", () => {
    test("only inconclusive protected lanes are requested", () => {
        const decisions = decidePairedRun([
            comparison({ effect: 0, pairs: 8 }),
            {
                ...comparison({
                    benchmark: "set 1000 atoms / valdres",
                    ratios: [1.0, 1.45, 1.0, 1.45, 1.0, 1.45],
                    jitter: 0.002,
                }),
                suite: "async",
            },
            {
                ...comparison({
                    benchmark: "tiny / valdres",
                    ratios: [1.0, 1.45, 1.0, 1.45],
                    jitter: 0.002,
                    family: "informational",
                }),
                runtime: "node",
            },
        ])
        expect(lanesNeedingRerun(decisions)).toEqual(["bun:async"])
    })

    test("a fully decided run requests nothing", () => {
        const decisions = decidePairedRun([comparison({ effect: 0, pairs: 8 })])
        expect(lanesNeedingRerun(decisions)).toEqual([])
    })
})

describe("guards", () => {
    test("a batch-size shift is reported but does not suppress the verdict", () => {
        const base = comparison({ effect: 0.5, pairs: 6 })
        const decision = decidePairedRun([
            {
                ...base,
                samples: base.samples.map((sample, i) => ({
                    ...sample,
                    baseBatchSize: 1024,
                    headBatchSize: i === 0 ? 128 : 1024,
                })),
            },
        ])[0]
        expect(decision.flags).toContain("batch-size-shift")
        expect(decision.outcome).toBe("regression")
    })

    test("identical samples cannot manufacture unbounded confidence", () => {
        const decision = decide({ ratios: [1.2, 1.2, 1.2, 1.2], jitter: 0 })
        expect(decision.standardErrorLn).toBeGreaterThanOrEqual(
            DEFAULT_PAIRED_POLICY.minStandardErrorLn,
        )
        expect(decision.outcome).toBe("regression")
    })
})
