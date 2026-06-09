import { describe, expect, test } from "bun:test"
import { wandTopK, type WandTerm } from "./wandTopK"

// Deterministic LCG (no Math.random — reproducible).
const lcg = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
}

const tieBreak = (a: number, b: number) => a - b // lower ordinal first

/** A test "term": its impact per doc (postings + maxImpact derive from it). */
type Impacts = Map<number, number>

const mkTerm = (impacts: Impacts): WandTerm => ({
    postings: Int32Array.from([...impacts.keys()].sort((a, b) => a - b)),
    maxImpact: impacts.size ? Math.max(...impacts.values()) : 0,
})

/** Doc score = sum of every term's impact for that doc. */
const mkScoreDoc =
    (impactsList: Impacts[]) =>
    (ordinal: number): number =>
        impactsList.reduce((s, im) => s + (im.get(ordinal) ?? 0), 0)

/** Brute force: score every doc via scoreDoc, sort by (score desc, ord asc),
 *  take top-K, applying the same null filter. */
const bruteForce = (
    impactsList: Impacts[],
    scoreDoc: (o: number) => number | null,
    k: number,
): { ordinal: number; score: number }[] => {
    const docs = new Set<number>()
    for (const im of impactsList) for (const d of im.keys()) docs.add(d)
    const out: { ordinal: number; score: number }[] = []
    for (const d of docs) {
        const s = scoreDoc(d)
        if (s !== null) out.push({ ordinal: d, score: s })
    }
    out.sort((a, b) =>
        b.score !== a.score ? b.score - a.score : a.ordinal - b.ordinal,
    )
    return out.slice(0, k)
}

const key = (h: { ordinal: number; score: number }) =>
    `${h.ordinal}:${h.score.toFixed(6)}`

describe("wandTopK", () => {
    test("matches brute force on a fixed corpus", () => {
        const impactsList = [
            new Map([[1, 2], [3, 5], [5, 1], [7, 3]]),
            new Map([[3, 4], [4, 9], [7, 2]]),
        ]
        const terms = impactsList.map(mkTerm)
        const scoreDoc = mkScoreDoc(impactsList)
        for (let k = 1; k <= 6; k++) {
            expect(wandTopK(terms, k, scoreDoc, tieBreak).map(key)).toEqual(
                bruteForce(impactsList, scoreDoc, k).map(key),
            )
        }
    })

    test("matches brute force across many random corpora", () => {
        const rnd = lcg(0xc0ffee)
        for (let trial = 0; trial < 300; trial++) {
            const numTerms = 1 + Math.floor(rnd() * 4)
            const universe = 1 + Math.floor(rnd() * 60)
            const impactsList: Impacts[] = []
            for (let t = 0; t < numTerms; t++) {
                const im: Impacts = new Map()
                for (let d = 0; d < universe; d++) {
                    if (rnd() < 0.4) im.set(d, Math.ceil(rnd() * 1000) / 100)
                }
                impactsList.push(im)
            }
            const terms = impactsList.map(mkTerm)
            const scoreDoc = mkScoreDoc(impactsList)
            const k = 1 + Math.floor(rnd() * 12)
            const got = wandTopK(terms, k, scoreDoc, tieBreak).map(key)
            const want = bruteForce(impactsList, scoreDoc, k).map(key)
            if (got.join("|") !== want.join("|")) {
                throw new Error(
                    `trial ${trial} mismatch\n got:  ${got.join(", ")}\n want: ${want.join(", ")}`,
                )
            }
        }
    })

    test("scoreDoc returning null drops the doc (minMatch-style filter)", () => {
        const impactsList = [
            new Map([[1, 5], [2, 5], [3, 5]]),
            new Map([[2, 5], [3, 5]]),
            new Map([[3, 5]]),
        ]
        const terms = impactsList.map(mkTerm)
        const base = mkScoreDoc(impactsList)
        // Require a doc to be in ≥ 2 terms, else null.
        const matchCount = (o: number) =>
            impactsList.filter(im => im.has(o)).length
        const scoreDoc = (o: number) => (matchCount(o) >= 2 ? base(o) : null)
        // doc 1 (1 term) excluded; 2 (2 terms) and 3 (3 terms) kept.
        expect(wandTopK(terms, 5, scoreDoc, tieBreak)).toEqual([
            { ordinal: 3, score: 15 },
            { ordinal: 2, score: 10 },
        ])
        expect(wandTopK(terms, 5, scoreDoc, tieBreak).map(key)).toEqual(
            bruteForce(impactsList, scoreDoc, 5).map(key),
        )
    })

    test("respects a loose (overestimated) maxImpact bound", () => {
        const impacts = new Map([[0, 1], [2, 8], [5, 3]])
        const term: WandTerm = {
            postings: Int32Array.from([0, 2, 5]),
            maxImpact: 100, // wildly loose — still correct, just less pruning
        }
        const scoreDoc = mkScoreDoc([impacts])
        expect(wandTopK([term], 2, scoreDoc, tieBreak).map(key)).toEqual(
            bruteForce([impacts], scoreDoc, 2).map(key),
        )
    })

    test("k larger than corpus returns everything ranked", () => {
        const impacts = new Map([[4, 5], [9, 2]])
        expect(
            wandTopK([mkTerm(impacts)], 100, mkScoreDoc([impacts]), tieBreak),
        ).toEqual([
            { ordinal: 4, score: 5 },
            { ordinal: 9, score: 2 },
        ])
    })

    test("empty inputs", () => {
        expect(wandTopK([], 5, () => 0, tieBreak)).toEqual([])
        expect(
            wandTopK(
                [{ postings: Int32Array.from([]), maxImpact: 0 }],
                5,
                () => 0,
                tieBreak,
            ),
        ).toEqual([])
    })
})
