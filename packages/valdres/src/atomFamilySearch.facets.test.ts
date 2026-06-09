import { describe, expect, test } from "bun:test"
import { atomFamily } from "./atomFamily"
import { atomFamilySearch } from "./atomFamilySearch"
import { store } from "./store"

/**
 * #12 — facet filtering + faceted counts. `facets` maps a doc to categorical
 * values; `search(query, { filter })` restricts results (AND across fields,
 * OR within a field's values); `search.facets(query, fields?)` counts matches
 * per value. Both read the facet extractor reactively at query time, so they
 * stay scope-correct and update when a doc's facet value changes.
 */
type Doc = {
    id: string
    text: string
    category: string
    tags: string[]
}

const mk = (extra?: { limit?: number }) => {
    const s = store()
    const post = atomFamily<Doc, [string]>(null, { name: "p" })
    const search = atomFamilySearch(post, (d: Doc) => d.text, {
        mode: "exact",
        match: "ranked",
        facets: (d: Doc) => ({ category: d.category, tags: d.tags }),
        ...(extra?.limit ? { limit: extra.limit } : {}),
    })
    return { s, post, search }
}
const ids = (rows: { atom: { familyArgsStringified: unknown } }[]) =>
    rows.map(r => String(r.atom.familyArgsStringified)).sort()

describe("atomFamilySearch — facet filter + counts (#12)", () => {
    test("filter restricts results to a single facet value", () => {
        const { s, post, search } = mk()
        s.set(post("a"), { id: "a", text: "alpha", category: "books", tags: [] })
        s.set(post("b"), { id: "b", text: "alpha", category: "film", tags: [] })
        s.set(post("c"), { id: "c", text: "alpha", category: "books", tags: [] })

        expect(ids(s.get(search.scored("alpha")))).toEqual(["a", "b", "c"])
        expect(
            ids(s.get(search.scored("alpha", { filter: { category: "books" } }))),
        ).toEqual(["a", "c"])
    })

    test("array filter values are OR'd within a field", () => {
        const { s, post, search } = mk()
        s.set(post("a"), { id: "a", text: "alpha", category: "books", tags: [] })
        s.set(post("b"), { id: "b", text: "alpha", category: "film", tags: [] })
        s.set(post("c"), { id: "c", text: "alpha", category: "music", tags: [] })

        expect(
            ids(
                s.get(
                    search.scored("alpha", {
                        filter: { category: ["books", "film"] },
                    }),
                ),
            ),
        ).toEqual(["a", "b"])
    })

    test("filters across fields are AND'd; values within tags are OR'd", () => {
        const { s, post, search } = mk()
        s.set(post("a"), {
            id: "a",
            text: "alpha",
            category: "books",
            tags: ["fiction", "new"],
        })
        s.set(post("b"), {
            id: "b",
            text: "alpha",
            category: "books",
            tags: ["nonfiction"],
        })
        s.set(post("c"), {
            id: "c",
            text: "alpha",
            category: "film",
            tags: ["fiction"],
        })

        // category=books AND tags∈{fiction} → only a (b is books but not
        // fiction; c is fiction but not books).
        expect(
            ids(
                s.get(
                    search.scored("alpha", {
                        filter: { category: "books", tags: "fiction" },
                    }),
                ),
            ),
        ).toEqual(["a"])
    })

    test("the bare search() atoms entry honors filter too", () => {
        const { s, post, search } = mk()
        s.set(post("a"), { id: "a", text: "alpha", category: "books", tags: [] })
        s.set(post("b"), { id: "b", text: "alpha", category: "film", tags: [] })
        const r = s
            .get(search("alpha", { filter: { category: "film" } }))
            .map(a => String(a.familyArgsStringified))
        expect(r).toEqual(["b"])
    })

    test("facets() counts values over the full match set", () => {
        const { s, post, search } = mk()
        s.set(post("a"), {
            id: "a",
            text: "alpha",
            category: "books",
            tags: ["x", "y"],
        })
        s.set(post("b"), {
            id: "b",
            text: "alpha",
            category: "film",
            tags: ["x"],
        })
        s.set(post("c"), {
            id: "c",
            text: "alpha",
            category: "books",
            tags: ["y"],
        })
        s.set(post("d"), {
            id: "d",
            text: "beta", // doesn't match "alpha"
            category: "books",
            tags: ["x"],
        })

        expect(s.get(search.facets("alpha"))).toEqual({
            category: { books: 2, film: 1 },
            tags: { x: 2, y: 2 },
        })
    })

    test("facets() counts each value once per document (deduped within a doc)", () => {
        const { s, post, search } = mk()
        // Doc a lists "x" twice — it's still one document for the count.
        s.set(post("a"), {
            id: "a",
            text: "alpha",
            category: "books",
            tags: ["x", "x", "y"],
        })
        s.set(post("b"), {
            id: "b",
            text: "alpha",
            category: "books",
            tags: ["x"],
        })
        expect(s.get(search.facets("alpha", ["tags"]))).toEqual({
            tags: { x: 2, y: 1 },
        })
    })

    test("facets() restricts to requested fields", () => {
        const { s, post, search } = mk()
        s.set(post("a"), {
            id: "a",
            text: "alpha",
            category: "books",
            tags: ["x"],
        })
        s.set(post("b"), {
            id: "b",
            text: "alpha",
            category: "film",
            tags: ["y"],
        })
        expect(s.get(search.facets("alpha", ["category"]))).toEqual({
            category: { books: 1, film: 1 },
        })
    })

    test("facets() ignores an active filter (shows available drill-downs)", () => {
        const { s, post, search } = mk()
        s.set(post("a"), { id: "a", text: "alpha", category: "books", tags: [] })
        s.set(post("b"), { id: "b", text: "alpha", category: "film", tags: [] })
        // facets() takes no filter — it always counts over all "alpha" matches.
        expect(s.get(search.facets("alpha", ["category"]))).toEqual({
            category: { books: 1, film: 1 },
        })
    })

    test("no facets option → filter yields nothing, facets() is empty", () => {
        const s = store()
        const post = atomFamily<Doc, [string]>(null, { name: "nofacets" })
        const search = atomFamilySearch(post, (d: Doc) => d.text, {
            mode: "exact",
            match: "ranked",
        })
        s.set(post("a"), { id: "a", text: "alpha", category: "books", tags: [] })
        // Filter requires the facets option; without it nothing passes.
        expect(
            ids(s.get(search.scored("alpha", { filter: { category: "books" } }))),
        ).toEqual([])
        // Unfiltered still works.
        expect(ids(s.get(search.scored("alpha")))).toEqual(["a"])
        expect(s.get(search.facets("alpha"))).toEqual({})
    })

    test("filter results are reactive to facet-value edits", () => {
        const { s, post, search } = mk()
        s.set(post("a"), { id: "a", text: "alpha", category: "books", tags: [] })
        s.set(post("b"), { id: "b", text: "alpha", category: "film", tags: [] })
        const booksSel = search.scored("alpha", { filter: { category: "books" } })
        expect(ids(s.get(booksSel))).toEqual(["a"])
        // Move b into books (text unchanged) → it should now pass the filter.
        s.set(post("b"), { id: "b", text: "alpha", category: "books", tags: [] })
        expect(ids(s.get(booksSel))).toEqual(["a", "b"])
        // Counts track the edit too.
        expect(s.get(search.facets("alpha", ["category"]))).toEqual({
            category: { books: 2 },
        })
    })

    test("filter composes with the instance limit (WAND-eligible) view", () => {
        const { s, post, search } = mk({ limit: 2 })
        for (let i = 0; i < 6; i++) {
            s.set(post(`d${i}`), {
                id: `d${i}`,
                text: "alpha",
                category: i % 2 === 0 ? "books" : "film",
                tags: [],
            })
        }
        // Filter routes off the WAND path to the full naive ranking, then the
        // limit slices — so we get at most 2 books-category matches.
        const r = s.get(search.scored("alpha", { filter: { category: "books" } }))
        expect(r.length).toBe(2)
        for (const row of r) {
            const id = String(row.atom.familyArgsStringified)
            expect(["d0", "d2", "d4"]).toContain(id)
        }
    })

    test("filter + weights together", () => {
        const s = store()
        const post = atomFamily<
            { id: string; title: string; body: string; category: string },
            [string]
        >(null, { name: "fw" })
        const search = atomFamilySearch(
            post,
            d => ({ title: d.title, body: d.body }),
            {
                mode: "exact",
                match: "ranked",
                fields: { title: { boost: 4 }, body: { boost: 1 } },
                facets: d => ({ category: d.category }),
            },
        )
        s.set(post("t"), {
            id: "t",
            title: "kingdom",
            body: "x",
            category: "books",
        })
        s.set(post("b"), {
            id: "b",
            title: "x",
            body: "kingdom",
            category: "books",
        })
        s.set(post("f"), {
            id: "f",
            title: "kingdom",
            body: "x",
            category: "film",
        })
        // Filter to books, then weight body above title → bodyHit "b" first.
        const r = s
            .get(
                search.scored("kingdom", {
                    filter: { category: "books" },
                    weights: { title: 1, body: 10 },
                }),
            )
            .map(x => String(x.atom.familyArgsStringified))
        expect(r).toEqual(["b", "t"])
    })

    test("filter works in a child scope (inherited + overridden docs)", () => {
        const { s, post, search } = mk()
        s.set(post("a"), { id: "a", text: "alpha", category: "books", tags: [] })
        s.set(post("b"), { id: "b", text: "alpha", category: "film", tags: [] })
        const child = s.scope("c1")
        // Override b's category to books in the child; add c (books) in child.
        child.set(post("b"), { id: "b", text: "alpha", category: "books", tags: [] })
        child.set(post("c"), { id: "c", text: "alpha", category: "books", tags: [] })

        // Root: only a is books.
        expect(
            ids(s.get(search.scored("alpha", { filter: { category: "books" } }))),
        ).toEqual(["a"])
        // Child: a (inherited) + b (overridden to books) + c (child-only).
        expect(
            ids(
                child.get(
                    search.scored("alpha", { filter: { category: "books" } }),
                ),
            ),
        ).toEqual(["a", "b", "c"])
    })
})

describe("atomFamilySearch — facet filter differential (vs manual predicate)", () => {
    const lcg = (seed: number) => () => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed / 0x100000000
    }
    const CATS = ["books", "film", "music", "art"]
    const TAGS = ["new", "old", "hot", "rare", "free"]
    const WORDS = ["alpha", "beta", "gamma", "delta", "eps"]

    test("filtered scored() == unfiltered scored() filtered by the same predicate", () => {
        const rnd = lcg(0xface7)
        const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
        const { s, post, search } = mk()
        const docs = new Map<string, Doc>()

        const matchesFilter = (
            d: Doc,
            filter: { category?: string[]; tags?: string[] },
        ): boolean => {
            if (filter.category && !filter.category.includes(d.category))
                return false
            if (filter.tags && !d.tags.some(t => filter.tags!.includes(t)))
                return false
            return true
        }

        for (let step = 0; step < 400; step++) {
            const id = `d${Math.floor(rnd() * 30)}`
            if (rnd() < 0.7 || docs.size === 0) {
                const tagCount = Math.floor(rnd() * 3)
                const tags = Array.from({ length: tagCount }, () => pick(TAGS))
                const doc: Doc = {
                    id,
                    text: `${pick(WORDS)} ${pick(WORDS)}`,
                    category: pick(CATS),
                    tags,
                }
                docs.set(id, doc)
                s.set(post(id), doc)
            } else {
                const victim = pick([...docs.keys()])
                docs.delete(victim)
                s.del(post(victim))
            }

            if (step % 20 !== 0) continue
            for (let q = 0; q < 3; q++) {
                const query = pick(WORDS)
                // Random filter: maybe category, maybe tags, maybe both.
                const filter: {
                    category?: string[]
                    tags?: string[]
                } = {}
                const pageFilter: Record<string, string | string[]> = {}
                if (rnd() < 0.7) {
                    const cs = [pick(CATS), pick(CATS)]
                    filter.category = cs
                    pageFilter.category = cs
                }
                if (rnd() < 0.5) {
                    const ts = [pick(TAGS)]
                    filter.tags = ts
                    pageFilter.tags = ts
                }
                const got = ids(
                    s.get(search.scored(query, { filter: pageFilter })),
                )
                const unfiltered = s
                    .get(search.scored(query))
                    .map(r => String(r.atom.familyArgsStringified))
                const want = unfiltered
                    .filter(docId => {
                        const d = docs.get(docId)
                        return d ? matchesFilter(d, filter) : false
                    })
                    .sort()
                expect(got).toEqual(want)
            }
        }
    })
})
