import { describe, expect, test } from "bun:test"
import { atomFamily } from "./atomFamily"
import { atomFamilySearch } from "./atomFamilySearch"
import { bm25Score, DEFAULT_BM25 } from "./lib/bm25"
import { store } from "./store"

/**
 * BM25F invariants for `atomFamilySearch`. Verifies the new scoring
 * matches the documented formula and behaves correctly across the three
 * modes, single vs multi-field extractors, and updates / deletes.
 *
 * Hand-computed numeric expectations are anchored against the same
 * `bm25Score` helper that the implementation uses so tests stay portable
 * if the BM25+ defaults ever shift.
 */
describe("atomFamilySearch — BM25F ranking", () => {
    describe("single-field, single-string extractor (backward-compat shape)", () => {
        test("matched docs are ranked above non-matches; relative order is sensible", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text)

            s.set(post("a"), { text: "hello world" })
            s.set(post("b"), { text: "hello there everyone" })
            s.set(post("c"), { text: "completely unrelated" })

            const r = s
                .get(search.scored("hello"))
                .map(x => x.atom.familyArgsStringified)
            // Both "a" and "b" match; "c" doesn't.
            expect(r).toContain("a")
            expect(r).toContain("b")
            expect(r).not.toContain("c")
            // Shorter matching doc with same TF outranks longer
            // (length normalization in action).
            expect(r[0]).toBe("a")
        })

        test("higher term frequency in a doc gives a higher score (with saturation)", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text)

            // "many" mentions "hello" 5 times; "once" mentions it once.
            // Both docs are the same length so length-normalization is
            // neutral, the only contributor is TF.
            s.set(post("many"), {
                text: "hello hello hello hello hello fill fill fill fill fill",
            })
            s.set(post("once"), {
                text: "hello fill fill fill fill fill fill fill fill fill",
            })

            const scored = s.get(search.scored("hello"))
            const byId = new Map(
                scored.map(x => [x.atom.familyArgsStringified, x.score]),
            )
            expect(byId.get("many")!).toBeGreaterThan(byId.get("once")!)
            // Saturation: 5× TF should NOT produce 5× score
            expect(byId.get("many")! / byId.get("once")!).toBeLessThan(3)
        })
    })

    describe("field-aware extractor", () => {
        test("higher-boosted field outranks the same word in a lower-boosted field", () => {
            const s = store()
            type Doc = { title: string; body: string }
            const post = atomFamily<Doc, [string]>()
            const search = atomFamilySearch(
                post,
                p => ({ title: p.title, body: p.body }),
                {
                    fields: {
                        title: { boost: 4 },
                        body: { boost: 1 },
                    },
                },
            )

            s.set(post("titleHit"), {
                title: "hello",
                body: "completely unrelated text padding here",
            })
            s.set(post("bodyHit"), {
                title: "completely unrelated padding",
                body: "hello",
            })

            const r = s
                .get(search.scored("hello"))
                .map(x => x.atom.familyArgsStringified)
            expect(r[0]).toBe("titleHit")
            expect(r[1]).toBe("bodyHit")
        })

        test("missing field on a doc contributes nothing", () => {
            const s = store()
            type Doc = { title: string; body?: string }
            const post = atomFamily<Doc, [string]>()
            const search = atomFamilySearch(
                post,
                p => {
                    const out: Record<string, string> = { title: p.title }
                    if (p.body) out.body = p.body
                    return out
                },
                {
                    fields: { title: { boost: 1 }, body: { boost: 1 } },
                },
            )

            s.set(post("titleOnly"), { title: "hello" })
            s.set(post("both"), { title: "hello", body: "hello" })

            const scored = s.get(search.scored("hello"))
            const byId = new Map(
                scored.map(x => [x.atom.familyArgsStringified, x.score]),
            )
            // both contribute from two fields; titleOnly from one
            expect(byId.get("both")!).toBeGreaterThan(byId.get("titleOnly")!)
        })
    })

    describe("BM25 knobs reach the formula", () => {
        test("b: 0 disables length normalization (longer docs no longer penalised)", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                bm25: { k1: 1.2, b: 0, d: 0.5 },
            })

            // Same TF, very different lengths.
            s.set(post("short"), { text: "hello" })
            s.set(post("long"), {
                text: "hello padding padding padding padding padding padding padding padding padding",
            })

            const scored = s.get(search.scored("hello"))
            const byId = new Map(
                scored.map(x => [x.atom.familyArgsStringified, x.score]),
            )
            // With b=0 length doesn't matter — scores should be very close.
            const ratio = byId.get("short")! / byId.get("long")!
            expect(ratio).toBeGreaterThan(0.95)
            expect(ratio).toBeLessThan(1.05)
        })

        test("b: 1 fully penalises long docs with the same TF as short docs", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                bm25: { k1: 1.2, b: 1, d: 0.5 },
            })

            s.set(post("short"), { text: "hello" })
            s.set(post("long"), {
                text: "hello padding padding padding padding padding padding padding padding padding",
            })

            const scored = s.get(search.scored("hello"))
            const byId = new Map(
                scored.map(x => [x.atom.familyArgsStringified, x.score]),
            )
            // With b=1 the short doc should comfortably outrank the long one
            expect(byId.get("short")!).toBeGreaterThan(byId.get("long")! * 1.5)
        })

        test("k1 controls TF saturation curve", () => {
            const sNormal = store()
            const sFlat = store()
            const post = atomFamily<{ text: string }, [string]>()

            const searchNormal = atomFamilySearch(post, p => p.text, {
                bm25: { k1: 1.2, b: 0.75, d: 0.5 },
            })
            const searchFlat = atomFamilySearch(post, p => p.text, {
                bm25: { k1: 0.01, b: 0.75, d: 0.5 },
            })

            sNormal.set(post("a"), {
                text: "hello hello hello fill fill fill fill fill fill fill",
            })
            sNormal.set(post("b"), {
                text: "hello fill fill fill fill fill fill fill fill fill",
            })
            sFlat.set(post("a"), {
                text: "hello hello hello fill fill fill fill fill fill fill",
            })
            sFlat.set(post("b"), {
                text: "hello fill fill fill fill fill fill fill fill fill",
            })

            const normalScores = new Map(
                sNormal
                    .get(searchNormal.scored("hello"))
                    .map(x => [x.atom.familyArgsStringified, x.score]),
            )
            const flatScores = new Map(
                sFlat
                    .get(searchFlat.scored("hello"))
                    .map(x => [x.atom.familyArgsStringified, x.score]),
            )

            // With small k1 the curve saturates almost immediately —
            // 3-TF and 1-TF should give nearly identical scores.
            const flatRatio = flatScores.get("a")! / flatScores.get("b")!
            // With default k1 the same docs should show a more pronounced
            // gap.
            const normalRatio =
                normalScores.get("a")! / normalScores.get("b")!
            expect(normalRatio).toBeGreaterThan(flatRatio)
        })
    })

    describe("trigram mode", () => {
        test("TF counted in trigrams; ranking is sensible end-to-end", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
            })

            s.set(post("exact"), { text: "hello" })
            s.set(post("typo"), { text: "hellp" })
            s.set(post("none"), { text: "world" })

            const r = s
                .get(search.scored("hello"))
                .map(x => x.atom.familyArgsStringified)
            expect(r[0]).toBe("exact")
            expect(r).toContain("typo")
            expect(r).not.toContain("none")
        })
    })

    describe("delete maintenance", () => {
        test("deleting a doc removes its TF contribution from future queries", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text)

            s.set(post("a"), { text: "hello" })
            s.set(post("b"), { text: "hello there" })

            const before = s.get(search("hello")).map(a => a.familyArgsStringified)
            expect(before).toContain("a")
            expect(before).toContain("b")

            s.del(post("a"))

            const after = s.get(search("hello")).map(a => a.familyArgsStringified)
            expect(after).not.toContain("a")
            expect(after).toContain("b")

            // And the score for b should still be a sensible positive number,
            // not negative or NaN from a broken avgdl.
            const scoredAfter = s.get(search.scored("hello"))
            expect(scoredAfter.length).toBe(1)
            expect(scoredAfter[0].score).toBeGreaterThan(0)
            expect(Number.isFinite(scoredAfter[0].score)).toBe(true)
        })
    })

    describe("BM25 helper math", () => {
        test("bm25Score matches the documented formula on a hand-picked case", () => {
            // Numbers chosen so the math is easy to verify by hand:
            // tf=1, df=1, N=10, dl=5, avgdl=10, defaults.
            const p = DEFAULT_BM25
            const idf = Math.log(1 + (10 - 1 + 0.5) / (1 + 0.5)) // ln(1 + 9.5/1.5)
            const expected =
                (idf * (p.d + 1 * (p.k1 + 1))) /
                (1 + p.k1 * (1 - p.b + (p.b * 5) / 10))
            expect(bm25Score(1, 1, 10, 5, 10, p)).toBeCloseTo(expected, 10)
        })

        test("tf = 0 returns 0 regardless of other params", () => {
            expect(bm25Score(0, 5, 100, 10, 10, DEFAULT_BM25)).toBe(0)
        })

        test("avgdl = 0 doesn't divide-by-zero", () => {
            // Edge case for a fresh / empty corpus
            const result = bm25Score(1, 1, 1, 0, 0, DEFAULT_BM25)
            expect(Number.isFinite(result)).toBe(true)
        })
    })
})
