import { describe, expect, test } from "bun:test"
import { wandTopK, type WandTerm } from "./wandTopK"

// Deterministic LCG (no Math.random — reproducible).
const lcg = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
}

const tieBreak = (a: number, b: number) => a - b // lower ordinal first

/** Brute force: score every document that appears in any posting, sort by
 *  (score desc, ordinal asc), take top-K. */
const bruteForce = (
    terms: WandTerm[],
    k: number,
): { ordinal: number; score: number }[] => {
    const docs = new Set<number>()
    for (const t of terms) for (const d of t.postings) docs.add(d)
    const scored = [...docs].map(d => ({
        ordinal: d,
        score: terms.reduce((s, t) => s + t.score(d), 0),
    }))
    scored.sort((a, b) =>
        b.score !== a.score ? b.score - a.score : a.ordinal - b.ordinal,
    )
    return scored.slice(0, k)
}

const key = (h: { ordinal: number; score: number }) =>
    `${h.ordinal}:${h.score.toFixed(6)}`

describe("wandTopK", () => {
    test("matches brute force on a hand-built case", () => {
        const mk = (
            postings: number[],
            impacts: Record<number, number>,
        ): WandTerm => ({
            postings: Int32Array.from(postings),
            maxImpact: Math.max(...Object.values(impacts)),
            score: o => impacts[o] ?? 0,
        })
        const terms = [
            mk([1, 3, 5, 7], { 1: 2, 3: 5, 5: 1, 7: 3 }),
            mk([3, 4, 7], { 3: 4, 4: 9, 7: 2 }),
        ]
        for (let k = 1; k <= 6; k++) {
            expect(wandTopK(terms, k, tieBreak).map(key)).toEqual(
                bruteForce(terms, k).map(key),
            )
        }
    })

    test("matches brute force across many random corpora", () => {
        const rnd = lcg(0xc0ffee)
        for (let trial = 0; trial < 300; trial++) {
            const numTerms = 1 + Math.floor(rnd() * 4)
            const universe = 1 + Math.floor(rnd() * 60)
            const terms: WandTerm[] = []
            for (let t = 0; t < numTerms; t++) {
                const impacts = new Map<number, number>()
                for (let d = 0; d < universe; d++) {
                    if (rnd() < 0.4) {
                        // Per-(term,doc) impact in (0, 10].
                        impacts.set(d, Math.ceil(rnd() * 1000) / 100)
                    }
                }
                const postings = Int32Array.from(
                    [...impacts.keys()].sort((a, b) => a - b),
                )
                const maxImpact = postings.length
                    ? Math.max(...impacts.values())
                    : 0
                terms.push({
                    postings,
                    maxImpact,
                    score: o => impacts.get(o) ?? 0,
                })
            }
            const k = 1 + Math.floor(rnd() * 12)
            const got = wandTopK(terms, k, tieBreak).map(key)
            const want = bruteForce(terms, k).map(key)
            if (got.join("|") !== want.join("|")) {
                throw new Error(
                    `trial ${trial} mismatch\n got:  ${got.join(", ")}\n want: ${want.join(", ")}`,
                )
            }
        }
    })

    test("respects a loose (overestimated) impact bound", () => {
        // Looser maxImpact must still produce correct results (just less
        // pruning) — never wrong, only slower.
        const impacts: Record<number, number> = { 0: 1, 2: 8, 5: 3 }
        const term: WandTerm = {
            postings: Int32Array.from([0, 2, 5]),
            maxImpact: 100, // wildly loose
            score: o => impacts[o] ?? 0,
        }
        expect(wandTopK([term], 2, tieBreak).map(key)).toEqual(
            bruteForce([term], 2).map(key),
        )
    })

    test("k larger than corpus returns everything ranked", () => {
        const term: WandTerm = {
            postings: Int32Array.from([4, 9]),
            maxImpact: 5,
            score: o => (o === 4 ? 5 : 2),
        }
        expect(wandTopK([term], 100, tieBreak)).toEqual([
            { ordinal: 4, score: 5 },
            { ordinal: 9, score: 2 },
        ])
    })

    test("empty inputs", () => {
        expect(wandTopK([], 5, tieBreak)).toEqual([])
        expect(
            wandTopK(
                [{ postings: Int32Array.from([]), maxImpact: 0, score: () => 0 }],
                5,
                tieBreak,
            ),
        ).toEqual([])
    })
})
