import { describe, expect, test } from "bun:test"
import { atomFamily } from "./atomFamily"
import { atomFamilySearch } from "./atomFamilySearch"
import { store } from "./store"

/**
 * #13 — query-time field weights. `search(query, { weights })` overrides the
 * construction-time per-field boosts for ONE query, so a single index can
 * serve different ranking needs (weight `title` for one search, `body` for
 * another). Fields absent from `weights` keep their construction boost.
 */
describe("atomFamilySearch — query-time field weights (#13)", () => {
    type Doc = { title: string; body: string }
    const mk = (limit?: number) => {
        const s = store()
        const post = atomFamily<Doc, [string]>()
        const search = atomFamilySearch(
            post,
            (d: Doc) => ({ title: d.title, body: d.body }),
            {
                mode: "exact",
                match: "ranked",
                fields: { title: { boost: 4 }, body: { boost: 1 } },
                ...(limit ? { limit } : {}),
            },
        )
        // titleHit: the query word lives in the title; bodyHit: in the body.
        // Same field lengths so the only ranking lever is the field boost.
        s.set(post("titleHit"), { title: "kingdom realm", body: "alpha beta" })
        s.set(post("bodyHit"), { title: "alpha beta", body: "kingdom realm" })
        return { s, search }
    }
    const ids = (rows: { atom: { familyArgsStringified: unknown } }[]) =>
        rows.map(r => String(r.atom.familyArgsStringified))

    test("default boosts: title match outranks body match", () => {
        const { s, search } = mk()
        expect(ids(s.get(search.scored("kingdom")))).toEqual([
            "titleHit",
            "bodyHit",
        ])
    })

    test("weights flip the ranking (body weighted above title)", () => {
        const { s, search } = mk()
        const weighted = ids(
            s.get(search.scored("kingdom", { weights: { title: 1, body: 10 } })),
        )
        expect(weighted).toEqual(["bodyHit", "titleHit"])
    })

    test("a field absent from weights keeps its construction boost", () => {
        const { s, search } = mk()
        // Only `title` is re-weighted (down to 1); `body` keeps its boost of 1.
        // Now both fields weigh 1, but titleHit's title still equals bodyHit's
        // body in length → near-tie, title-then-body tiebreak is by score then
        // atom order. Re-weighting title BELOW body must put bodyHit first.
        const r = ids(
            s.get(search.scored("kingdom", { weights: { title: 0.1 } })),
        )
        expect(r).toEqual(["bodyHit", "titleHit"])
    })

    test("default view is unaffected by a prior weighted query (independent cache)", () => {
        const { s, search } = mk()
        // Run weighted first, then default — the default ranking must be intact.
        ids(s.get(search.scored("kingdom", { weights: { body: 10 } })))
        expect(ids(s.get(search.scored("kingdom")))).toEqual([
            "titleHit",
            "bodyHit",
        ])
    })

    test("the bare search() entry honors weights too", () => {
        const { s, search } = mk()
        const r = s
            .get(search("kingdom", { weights: { title: 1, body: 10 } }))
            .map(a => String(a.familyArgsStringified))
        expect(r).toEqual(["bodyHit", "titleHit"])
    })

    test("releaseQuery reclaims weighted cache entries", () => {
        const { s, search } = mk()
        s.get(search.scored("kingdom", { weights: { body: 10 } }))
        s.get(search.scored("kingdom"))
        // releaseQuery keys on the bare query and reclaims every windowed /
        // weighted variant of it.
        expect(search.releaseQuery("kingdom")).toBe(true)
        // A second release finds nothing left.
        expect(search.releaseQuery("kingdom")).toBe(false)
    })

    test("WAND top-K path (instance limit) honors weights", () => {
        // With an instance `limit` the default view goes through WAND top-K.
        // Weighted ranking must match the same flip as the full-ranking path.
        const { s, search } = mk(5)
        expect(ids(s.get(search.scored("kingdom")))).toEqual([
            "titleHit",
            "bodyHit",
        ])
        expect(
            ids(s.get(search.scored("kingdom", { weights: { body: 10 } }))),
        ).toEqual(["bodyHit", "titleHit"])
    })
})
