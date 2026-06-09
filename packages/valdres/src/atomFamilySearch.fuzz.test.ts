import { describe, expect, test } from "bun:test"
import { atomFamily } from "./atomFamily"
import { atomFamilySearch } from "./atomFamilySearch"
import { bm25Idf, bm25ScoreWithIdf, DEFAULT_BM25 } from "./lib/bm25"
import { store } from "./store"
import { defaultTokenize } from "./utils/defaultTokenize"

// Differential fuzzer: drives random write / rewrite / delete sequences through
// the real incrementally-maintained search index, and after each batch asserts
// scored() matches a brute-force recompute from the current document set. The
// oracle uses the SAME scoring primitives (bm25Idf / bm25ScoreWithIdf /
// defaultTokenize / coordination formula), so the BM25 formula matches by
// construction — what's under test is the INCREMENTAL INDEX maintenance
// (buckets, per-field stats, fieldTotals, delete cleanup) across mutations.
//
// This is also the oracle the planned #6 unified descriptor must pass (see
// dev/search-engine-v2.md): same harness, run the unified instance through it.

type Doc = { id: string; title: string; body: string }
type Cfg = {
    boosts: Record<"title" | "body", number>
    coordination: number
    match: "all" | "ranked"
}

const FIELDS = ["title", "body"] as const

/** Brute-force scored() over the live doc set, mirroring computeScored for
 *  exact mode (no tolerance / phrase / stemming). Returns id -> score. */
const oracle = (
    docs: Map<string, Doc>,
    query: string,
    cfg: Cfg,
): Map<string, number> => {
    const queryTokens = defaultTokenize(query)
    const result = new Map<string, number>()
    if (queryTokens.length === 0) return result
    const N = Math.max(docs.size, 1)
    const distinct = new Set(queryTokens).size

    // Per-field tokenization + corpus stats.
    const tok = new Map<string, Record<string, string[]>>()
    const fieldTotal: Record<string, { len: number; count: number }> = {}
    for (const [id, doc] of docs) {
        const perField: Record<string, string[]> = {}
        for (const f of FIELDS) {
            const ts = defaultTokenize(doc[f])
            if (ts.length === 0) continue
            perField[f] = ts
            const ft = (fieldTotal[f] ??= { len: 0, count: 0 })
            ft.len += ts.length
            ft.count += 1
        }
        tok.set(id, perField)
    }
    const dfOf = (term: string): number => {
        let df = 0
        for (const [, perField] of tok) {
            let has = false
            for (const f of FIELDS)
                if (perField[f]?.includes(term)) {
                    has = true
                    break
                }
            if (has) df++
        }
        return df
    }

    const scores = new Map<string, number>()
    const matched = new Map<string, Set<string>>()
    const perToken: Set<string>[] = []
    for (const qt of queryTokens) {
        const df = dfOf(qt)
        const here = new Set<string>()
        if (df > 0) {
            const idf = bm25Idf(df, N)
            for (const [id, perField] of tok) {
                let s = 0
                for (const f of FIELDS) {
                    const ts = perField[f]
                    if (!ts) continue
                    let tf = 0
                    for (const t of ts) if (t === qt) tf++
                    if (tf === 0) continue
                    const ft = fieldTotal[f]
                    const avgdl = ft.len / ft.count
                    s +=
                        cfg.boosts[f as "title" | "body"] *
                        bm25ScoreWithIdf(idf, tf, ts.length, avgdl, DEFAULT_BM25)
                }
                if (s <= 0) continue
                scores.set(id, (scores.get(id) ?? 0) + s)
                ;(matched.get(id) ?? matched.set(id, new Set()).get(id)!).add(qt)
                here.add(id)
            }
        }
        if (cfg.match === "all" && here.size === 0) return result
        perToken.push(here)
    }

    let candidates: Iterable<string>
    if (cfg.match === "all") {
        // Intersection across tokens.
        let inter = perToken[0] ?? new Set<string>()
        for (let i = 1; i < perToken.length; i++) {
            const next = new Set<string>()
            for (const id of inter) if (perToken[i].has(id)) next.add(id)
            inter = next
        }
        candidates = inter
    } else {
        candidates = scores.keys()
    }
    for (const id of candidates) {
        let score = scores.get(id) ?? 0
        if (cfg.coordination > 0 && distinct > 0) {
            const coverage = (matched.get(id)?.size ?? 0) / distinct
            score *=
                1 - cfg.coordination + cfg.coordination * coverage
        }
        result.set(id, score)
    }
    return result
}

describe("atomFamilySearch — differential fuzzer (incremental index vs brute force)", () => {
    const lcg = (seed: number) => () => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed / 0x100000000
    }
    // Small recurring vocabulary so terms collide across docs (exercises df,
    // shared buckets, rewrites changing membership).
    const VOCAB = [
        "alpha","beta","gamma","delta","eps","zeta","eta","theta","iota","kappa",
        "rare","common","storm","city","king",
    ]

    for (const cfg of [
        { boosts: { title: 2, body: 1 }, coordination: 0.5, match: "ranked" as const },
        { boosts: { title: 1, body: 1 }, coordination: 0, match: "ranked" as const },
        { boosts: { title: 3, body: 1 }, coordination: 0.5, match: "all" as const },
    ]) {
        test(`matches oracle through random mutations (${cfg.match}, coord ${cfg.coordination})`, () => {
            const rnd = lcg(0xa11ce ^ (cfg.coordination * 1000) ^ (cfg.match === "all" ? 7 : 0))
            const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
            const words = (n: number) =>
                Array.from({ length: n }, () => pick(VOCAB)).join(" ")

            const s = store()
            const post = atomFamily<Doc, [string]>(null, { name: "p" })
            const search = atomFamilySearch(
                post,
                (d: Doc) => ({ title: d.title, body: d.body }),
                {
                    mode: "exact",
                    match: cfg.match,
                    coordination: cfg.coordination,
                    fields: {
                        title: { boost: cfg.boosts.title },
                        body: { boost: cfg.boosts.body },
                    },
                },
            )
            const docs = new Map<string, Doc>()

            const checkQueries = () => {
                for (let q = 0; q < 4; q++) {
                    const query = words(1 + Math.floor(rnd() * 3))
                    // Unsubscribed pull read (the round-1 staleness class).
                    const got = s
                        .get(search.scored(query))
                        .map(r => ({
                            id: String(r.atom.familyArgsStringified),
                            score: r.score,
                        }))
                    const want = oracle(docs, query, cfg)

                    // 1. Same result set.
                    expect(new Set(got.map(g => g.id))).toEqual(
                        new Set(want.keys()),
                    )
                    // 2. Same score per doc.
                    for (const g of got) {
                        expect(g.score).toBeCloseTo(want.get(g.id) as number, 6)
                    }
                    // 3. Non-increasing score order.
                    for (let i = 1; i < got.length; i++) {
                        expect(got[i].score).toBeLessThanOrEqual(
                            got[i - 1].score + 1e-9,
                        )
                    }
                }
            }

            for (let step = 0; step < 600; step++) {
                const roll = rnd()
                const id = `d${Math.floor(rnd() * 40)}` // 40-id space → churn
                if (roll < 0.6 || docs.size === 0) {
                    const doc: Doc = {
                        id,
                        title: words(1 + Math.floor(rnd() * 3)),
                        body: words(1 + Math.floor(rnd() * 6)),
                    }
                    docs.set(id, doc) // set OR rewrite
                    s.set(post(id), doc)
                } else {
                    // delete a random existing doc
                    const existing = [...docs.keys()]
                    const victim = pick(existing)
                    docs.delete(victim)
                    s.del(post(victim))
                }
                if (step % 25 === 0) checkQueries()
            }
            checkQueries()
        })
    }

    // WAND top-K path must be byte-identical to the naive ranking on the same
    // data. Run the SAME random mutations through two independent instances —
    // one forced naive (`__wand: false`), one auto (WAND for eligible ranked +
    // limited queries) — and compare scored() output (ids, scores, order).
    for (const variant of [
        { mode: "exact" as const, tolerance: 0, coordination: 0.5, limit: 7 },
        { mode: "exact" as const, tolerance: 0, coordination: 0, limit: 5 },
        { mode: "prefix" as const, tolerance: 0, coordination: 0.5, limit: 6 },
        { mode: "exact" as const, tolerance: 1, coordination: 0.5, limit: 8 },
        // #13: query-time weights must keep WAND's maxImpact bound valid — the
        // weighted score is still ≤ Σ (weight × bm25), so the pruning stays
        // exact. Both paths get the SAME weights; output must be identical.
        {
            mode: "exact" as const,
            tolerance: 0,
            coordination: 0.5,
            limit: 7,
            weights: { title: 5, body: 0.5 } as Record<string, number>,
        },
        {
            mode: "prefix" as const,
            tolerance: 0,
            coordination: 0,
            limit: 6,
            weights: { body: 3 } as Record<string, number>,
        },
    ]) {
        const weights = (variant as { weights?: Record<string, number> })
            .weights
        test(`WAND path == naive path (${variant.mode}, tol ${variant.tolerance}, coord ${variant.coordination}${weights ? ", weighted" : ""})`, () => {
            const rnd = lcg(
                0x5eed ^
                    variant.limit ^
                    (variant.tolerance << 4) ^
                    (weights ? 0x1357 : 0),
            )
            const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
            const words = (n: number) =>
                Array.from({ length: n }, () => pick(VOCAB)).join(" ")
            const opts = {
                mode: variant.mode,
                match: "ranked" as const,
                coordination: variant.coordination,
                tolerance: variant.tolerance,
                limit: variant.limit,
                fields: { title: { boost: 2 }, body: { boost: 1 } },
            }
            const nf = atomFamily<Doc, [string]>(null, { name: "wn" })
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const naive = atomFamilySearch(nf, (d: Doc) => ({ title: d.title, body: d.body }), { ...opts, __wand: false } as any)
            const ns = store()
            const wf = atomFamily<Doc, [string]>(null, { name: "ww" })
            const wand = atomFamilySearch(wf, (d: Doc) => ({ title: d.title, body: d.body }), opts)
            const ws = store()

            const repr = (
                rows: { atom: { familyArgsStringified: unknown }; score: number }[],
            ) =>
                rows.map(
                    r => `${String(r.atom.familyArgsStringified)}:${r.score.toFixed(6)}`,
                )

            const page = weights ? { weights } : undefined
            const compare = () => {
                for (let q = 0; q < 5; q++) {
                    const query = words(1 + Math.floor(rnd() * 3))
                    const got = repr(ws.get(wand.scored(query, page)))
                    const want = repr(ns.get(naive.scored(query, page)))
                    expect(got).toEqual(want)
                }
            }

            for (let step = 0; step < 500; step++) {
                const id = `d${Math.floor(rnd() * 40)}`
                if (rnd() < 0.65) {
                    const doc: Doc = {
                        id,
                        title: words(1 + Math.floor(rnd() * 3)),
                        body: words(1 + Math.floor(rnd() * 6)),
                    }
                    ns.set(nf(id), doc)
                    ws.set(wf(id), doc)
                } else {
                    ns.del(nf(id))
                    ws.del(wf(id))
                }
                if (step % 20 === 0) compare()
            }
            compare()
        })
    }

    test("child scope sees inherited + overridden docs (set membership)", () => {
        const s = store()
        const post = atomFamily<Doc, [string]>(null, { name: "p" })
        const search = atomFamilySearch(
            post,
            (d: Doc) => ({ title: d.title, body: d.body }),
            { mode: "exact", match: "ranked" },
        )
        s.set(post("a"), { id: "a", title: "alpha", body: "shared" })
        s.set(post("b"), { id: "b", title: "beta", body: "shared" })
        const child = s.scope("c1")
        // Override b in the child; add c only in the child.
        child.set(post("b"), { id: "b", title: "gamma", body: "shared" })
        child.set(post("c"), { id: "c", title: "alpha", body: "shared" })

        const ids = (st: ReturnType<typeof store>, q: string) =>
            st.get(search(q)).map(a => String(a.familyArgsStringified)).sort()

        // Root: "alpha" → a only (b still beta in root, c doesn't exist).
        expect(ids(s, "alpha")).toEqual(["a"])
        // Child: "alpha" → a (inherited) + c (child-only). b is gamma here.
        expect(ids(child, "alpha")).toEqual(["a", "c"])
        // Child: "gamma" → b (overridden). Root: "gamma" → none.
        expect(ids(child, "gamma")).toEqual(["b"])
        expect(ids(s, "gamma")).toEqual([])
        // "shared" is in every doc's body.
        expect(ids(s, "shared")).toEqual(["a", "b"])
        expect(ids(child, "shared")).toEqual(["a", "b", "c"])
    })
})
