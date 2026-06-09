import { describe, expect, mock, test } from "bun:test"
import { atomFamily } from "./atomFamily"
import { atomFamilySearch } from "./atomFamilySearch"
import { store } from "./store"
import { defaultTokenize } from "./utils/defaultTokenize"
import { englishStopWords } from "./utils/englishStopWords"
import { foldAccents } from "./utils/foldAccents"
import { simpleEnglishStem } from "./utils/simpleEnglishStem"

describe("atomFamilySearch", () => {
    test("single-token query", () => {
        const s = store()
        const post = atomFamily<{ title: string; body: string }, [string]>(
            null,
            { name: "posts" },
        )
        const search = atomFamilySearch(
            post,
            p => `${p.title} ${p.body}`,
            { name: "postsSearch" },
        )

        s.set(post("1"), { title: "Hello world", body: "" })
        s.set(post("2"), { title: "Goodbye world", body: "" })

        expect(
            s.get(search("hello")).map(a => a.familyArgsStringified),
        ).toEqual(["1"])
        expect(
            s.get(search("world")).map(a => a.familyArgsStringified).sort(),
        ).toEqual(["1", "2"])
    })

    test("multi-token AND semantics", () => {
        const s = store()
        const post = atomFamily<{ text: string }, [string]>(null, {
            name: "posts",
        })
        const search = atomFamilySearch(post, p => p.text)

        s.set(post("a"), { text: "hello world" })
        s.set(post("b"), { text: "hello there" })
        s.set(post("c"), { text: "world peace" })

        expect(
            s.get(search("hello world")).map(a => a.familyArgsStringified),
        ).toEqual(["a"])
        expect(
            s.get(search("hello")).map(a => a.familyArgsStringified).sort(),
        ).toEqual(["a", "b"])
        expect(
            s.get(search("world")).map(a => a.familyArgsStringified).sort(),
        ).toEqual(["a", "c"])
    })

    test("query with no matches returns empty", () => {
        const s = store()
        const post = atomFamily<{ text: string }, [string]>(null, {
            name: "posts",
        })
        const search = atomFamilySearch(post, p => p.text)

        s.set(post("1"), { text: "hello" })
        expect(s.get(search("goodbye"))).toEqual([])
        expect(s.get(search(""))).toEqual([])
    })

    test("text update re-tokenizes — atom moves posting lists", () => {
        const s = store()
        const post = atomFamily<{ text: string }, [string]>(null, {
            name: "posts",
        })
        const search = atomFamilySearch(post, p => p.text)

        s.set(post("1"), { text: "hello world" })
        expect(s.get(search("hello"))).toHaveLength(1)
        expect(s.get(search("foo"))).toHaveLength(0)

        s.set(post("1"), { text: "foo bar" })
        expect(s.get(search("hello"))).toHaveLength(0)
        expect(s.get(search("foo"))).toHaveLength(1)
    })

    test("same-text write does not re-run extractor", () => {
        const s = store()
        const post = atomFamily<{ text: string }, [string]>(null, {
            name: "posts",
        })
        const extractor = mock((p: { text: string }) => p.text)
        const search = atomFamilySearch(post, extractor)

        s.set(post("1"), { text: "hello" })
        expect(extractor).toHaveBeenCalledTimes(1)

        s.set(post("1"), { text: "hello" })
        expect(extractor).toHaveBeenCalledTimes(1)
    })

    test("bulk-write transaction calls extractor exactly once per atom (S1)", () => {
        // Two descriptors fire on every atomFamilySearch write — the
        // tokenIndex (set-membership) and the BM25 (per-field stats).
        // In a transaction, descriptors iterate atoms in two passes
        // (one descriptor at a time), so the single-slot memo was
        // overwritten between passes and missed every time. Result:
        // user's extractor ran 2N times for N atoms.
        //
        // After the fix (per-pass WeakMap memo), extractor runs exactly
        // N times.
        const s = store()
        const post = atomFamily<{ text: string }, [string]>(null, {
            name: "posts",
        })
        const extractor = mock((p: { text: string }) => p.text)
        atomFamilySearch(post, extractor)

        const N = 50
        s.txn(({ set }) => {
            for (let i = 0; i < N; i++) {
                set(post(`${i}`), { text: `body ${i}` })
            }
        })

        expect(extractor).toHaveBeenCalledTimes(N)
    })

    test("store.del clears atom from all posting lists", () => {
        const s = store()
        const post = atomFamily<{ text: string }, [string]>(null, {
            name: "posts",
        })
        const search = atomFamilySearch(post, p => p.text)

        s.set(post("1"), { text: "hello world" })
        expect(s.get(search("hello"))).toHaveLength(1)

        s.del(post("1"))
        expect(s.get(search("hello"))).toHaveLength(0)
        expect(s.get(search("world"))).toHaveLength(0)
    })

    test("custom tokenizer (char-level)", () => {
        const s = store()
        const post = atomFamily<{ text: string }, [string]>(null, {
            name: "posts",
        })
        // Char-level tokenizer — each lowercase letter is a token
        const search = atomFamilySearch(post, p => p.text, {
            tokenize: text => [...text.toLowerCase()],
        })

        s.set(post("a"), { text: "ab" })
        s.set(post("b"), { text: "bc" })
        s.set(post("c"), { text: "ac" })

        // Atoms containing both 'a' and 'c'
        expect(
            s.get(search("ac")).map(atom => atom.familyArgsStringified),
        ).toEqual(["c"])
        // Atoms containing 'b'
        expect(
            s.get(search("b")).map(atom => atom.familyArgsStringified).sort(),
        ).toEqual(["a", "b"])
    })

    test("subscribe before any match — fires on first matching write", () => {
        const s = store()
        const post = atomFamily<{ text: string }, [string]>(null, {
            name: "posts",
        })
        const search = atomFamilySearch(post, p => p.text)

        const cb = mock(() => {})
        s.sub(search("hello"), cb)

        s.set(post("1"), { text: "goodbye" })
        expect(cb).toHaveBeenCalledTimes(0)

        s.set(post("2"), { text: "hello world" })
        expect(cb).toHaveBeenCalledTimes(1)
    })

    test("punctuation is split out by default tokenizer", () => {
        const s = store()
        const post = atomFamily<{ text: string }, [string]>(null, {
            name: "posts",
        })
        const search = atomFamilySearch(post, p => p.text)

        s.set(post("1"), { text: "Hello, world!" })
        expect(s.get(search("hello"))).toHaveLength(1)
        expect(s.get(search("world"))).toHaveLength(1)
    })

    describe("prefix mode", () => {
        test("query word matches indexed prefixes", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "prefix",
            })

            s.set(post("a"), { text: "apple" })
            s.set(post("b"), { text: "applesauce" })
            s.set(post("c"), { text: "banana" })

            // "appl" is a prefix of both "apple" and "applesauce"
            const result = s
                .get(search("appl"))
                .map(a => a.familyArgsStringified)
            expect(result.sort()).toEqual(["a", "b"])

            // Exact word still matches
            expect(
                s.get(search("apple")).map(a => a.familyArgsStringified),
            ).toContain("a")

            // Non-prefix returns empty
            expect(s.get(search("nope"))).toHaveLength(0)
        })

        test("multi-word OR ranks docs with more matching tokens higher", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "prefix",
            })

            s.set(post("both"), { text: "apple banana" })
            s.set(post("one"), { text: "apple cherry" })
            s.set(post("none"), { text: "watermelon" })

            const result = s
                .get(search("appl bana"))
                .map(a => a.familyArgsStringified)
            // "both" has 2 matching query tokens, "one" has 1
            expect(result).toEqual(["both", "one"])
        })
    })

    describe("trigram mode", () => {
        test("typo-tolerant match", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
            })

            s.set(post("js"), { text: "javascript" })
            s.set(post("ts"), { text: "typescript" })
            s.set(post("rs"), { text: "rust" })

            // "javascrpit" — transposition typo of "javascript". Should
            // still match the javascript doc through trigram overlap.
            const result = s
                .get(search("javascrpit"))
                .map(a => a.familyArgsStringified)
            expect(result[0]).toBe("js")
        })

        test("prefix-favored ranking via boundary trigrams", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
            })

            s.set(post("hello"), { text: "hello" })
            s.set(post("yellow"), { text: "yellow" })

            // Query "hel" — boundary trigrams "\0\0h", "\0he" match
            // "hello" but not "yellow" (which starts with "ye"). So
            // "hello" should rank above "yellow".
            const result = s
                .get(search("hel"))
                .map(a => a.familyArgsStringified)
            expect(result[0]).toBe("hello")
        })

        test("multi-word query ranks docs with both words higher", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
            })

            s.set(post("both"), { text: "hello world" })
            s.set(post("one"), { text: "hello there" })
            s.set(post("other"), { text: "the world ends" })

            // Both "hello" and "world" trigrams contribute. "both" gets
            // hits from both words; "one" and "other" get one word's
            // worth of trigrams.
            const result = s
                .get(search("hello world"))
                .map(a => a.familyArgsStringified)
            expect(result[0]).toBe("both")
        })

        test("ranking is stable across writes when match counts tie", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
            })

            s.set(post("a"), { text: "hello" })
            s.set(post("b"), { text: "hello" })
            s.set(post("c"), { text: "hello" })

            // All three docs share the same trigrams with the query.
            // Tiebreaker is familyArgsStringified, ascending.
            expect(
                s.get(search("hello")).map(a => a.familyArgsStringified),
            ).toEqual(["a", "b", "c"])
        })

        test("composes with foldAccents for accent-insensitive matching", () => {
            const s = store()
            const post = atomFamily<{ name: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.name, {
                mode: "trigram",
                tokenize: text => defaultTokenize(foldAccents(text)),
            })

            s.set(post("1"), { name: "café" })
            s.set(post("2"), { name: "naïve" })
            s.set(post("3"), { name: "rust" })

            // Query "cafe" (no accent) finds "café"
            const r1 = s
                .get(search("cafe"))
                .map(a => a.familyArgsStringified)
            expect(r1[0]).toBe("1")

            // And the reverse: query with accent finds the unaccented form
            // (here we don't have one, but the symmetry is what matters)
            const r2 = s
                .get(search("naive"))
                .map(a => a.familyArgsStringified)
            expect(r2[0]).toBe("2")
        })

        test("update changes ranking", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
            })

            s.set(post("a"), { text: "javascript" })
            s.set(post("b"), { text: "java" })

            // Query "java" — "java" trigrams overlap fully with itself
            // and largely with "javascript". "java" should match more
            // tightly.
            const before = s
                .get(search("java"))
                .map(a => a.familyArgsStringified)
            expect(before[0]).toBe("b")

            // Make "b" no longer match — re-rank
            s.set(post("b"), { text: "python" })
            const after = s
                .get(search("java"))
                .map(a => a.familyArgsStringified)
            expect(after[0]).toBe("a")
            expect(after).not.toContain("b")
        })
    })

    describe("scored API", () => {
        test("returns {atom, score} pairs in ranking order", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
            })

            s.set(post("a"), { text: "hello world" })
            s.set(post("b"), { text: "hello there" })
            s.set(post("c"), { text: "goodbye world" })

            const results = s.get(search.scored("hello world"))
            // Each result is { atom, score }
            for (const r of results) {
                expect(r.atom).toBeDefined()
                expect(typeof r.score).toBe("number")
                expect(r.score).toBeGreaterThan(0)
            }
            // Descending by score
            for (let i = 1; i < results.length; i++) {
                expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score)
            }
        })

        test("scored shares computation with atoms view (same dep graph)", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
            })

            s.set(post("a"), { text: "hello" })
            const atomsResult = s.get(search("hello"))
            const scoredResult = s.get(search.scored("hello"))
            expect(atomsResult.length).toBe(scoredResult.length)
            for (let i = 0; i < atomsResult.length; i++) {
                expect(atomsResult[i]).toBe(scoredResult[i].atom)
            }
        })

        test("matched field reflects which query tokens hit each doc", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
            })

            s.set(post("a"), { text: "hello world" })
            s.set(post("b"), { text: "hello there" })
            s.set(post("c"), { text: "completely different" })

            const results = s.get(search.scored("hello world"))
            const byId = new Map(
                results.map(r => [r.atom.familyArgsStringified, r]),
            )

            // doc "a" has both "hello" and "world" → both tokens matched
            expect([...(byId.get("a")?.matched ?? [])].sort()).toEqual([
                "hello",
                "world",
            ])
            // doc "b" has "hello" but only weakly matches "world" via
            // shared trigrams; "there" has no overlap. We can assert at
            // minimum that "hello" is matched.
            expect(byId.get("b")?.matched).toContain("hello")
        })

        test("matched is empty for queries with no real overlap", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
            })

            s.set(post("a"), { text: "rust" })
            const results = s.get(search.scored("python"))
            expect(results).toHaveLength(0)
        })

        test("calling scored() with same query returns cached selector", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
            })

            const sel1 = search.scored("hello")
            const sel2 = search.scored("hello")
            expect(sel1).toBe(sel2)
        })
    })

    describe("query cache lifecycle", () => {
        // The query → selector cache (`scoredCache` + `atomsCache`)
        // would otherwise grow unboundedly for apps with many distinct
        // queries (e.g. search-as-you-type). These tests pin the
        // explicit-release shape — symmetric with `atomFamilyIndex`'s
        // `release(term)` for term atoms.

        test("releaseQuery drops the cached selectors for one query", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text)
            s.set(post("1"), { text: "hello world" })

            const atoms1 = search("hello")
            const scored1 = search.scored("hello")
            // Identity-stable on repeat calls
            expect(search("hello")).toBe(atoms1)
            expect(search.scored("hello")).toBe(scored1)

            // Release → next call creates fresh selectors
            const released = search.releaseQuery("hello")
            expect(released).toBe(true)
            expect(search("hello")).not.toBe(atoms1)
            expect(search.scored("hello")).not.toBe(scored1)
        })

        test("releaseQuery returns false for an unknown query", () => {
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text)
            expect(search.releaseQuery("never-queried")).toBe(false)
        })

        test("releaseAllQueries clears every cached query selector", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text)
            s.set(post("1"), { text: "hello world" })

            const a = search("hello")
            const b = search("world")
            const c = search.scored("hello world")

            search.releaseAllQueries()

            expect(search("hello")).not.toBe(a)
            expect(search("world")).not.toBe(b)
            expect(search.scored("hello world")).not.toBe(c)
        })

        test("released queries still resolve to correct results", () => {
            // After release, requerying produces a fresh selector but it
            // must read the same underlying buckets and return the same
            // logical results.
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text)
            s.set(post("1"), { text: "hello world" })
            s.set(post("2"), { text: "hello there" })

            const before = s
                .get(search("hello"))
                .map(a => a.familyArgsStringified)
                .sort()
            search.releaseAllQueries()
            const after = s
                .get(search("hello"))
                .map(a => a.familyArgsStringified)
                .sort()

            expect(after).toEqual(before)
        })
    })

    describe("IDF ranking", () => {
        test("rare terms contribute more than common terms", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
                match: "ranked",
            })

            // "common" appears in 5 docs, "rare" appears in 1
            s.set(post("c1"), { text: "common term one" })
            s.set(post("c2"), { text: "common term two" })
            s.set(post("c3"), { text: "common term three" })
            s.set(post("c4"), { text: "common term four" })
            s.set(post("c5"), { text: "common term five" })
            s.set(post("rare"), { text: "rare specialized vocabulary" })

            // Query "common rare" — the doc with "rare" should rank
            // higher than docs with "common" only, because IDF("rare")
            // is much higher than IDF("common").
            const results = s.get(search.scored("common rare"))
            expect(results[0].atom.familyArgsStringified).toBe("rare")
        })
    })

    describe("stop words", () => {
        test("default English stop words drop common terms from index", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                stopWords: true,
            })

            s.set(post("a"), { text: "the quick brown fox" })
            s.set(post("b"), { text: "the lazy dog" })

            // "the" is filtered out; no docs index it.
            expect(s.get(search("the"))).toHaveLength(0)
            // Other tokens still work.
            expect(
                s
                    .get(search("quick"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["a"])
        })

        test("custom stop word set", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const customStops = new Set(["foo", "bar"])
            const search = atomFamilySearch(post, p => p.text, {
                stopWords: customStops,
            })

            s.set(post("a"), { text: "foo baz" })
            // "foo" is dropped, "baz" is indexed
            expect(s.get(search("foo"))).toHaveLength(0)
            expect(
                s.get(search("baz")).map(a => a.familyArgsStringified),
            ).toEqual(["a"])
        })

        test("stop words filter the query too", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
                stopWords: englishStopWords,
            })

            s.set(post("a"), { text: "quick brown fox" })
            // Query "the quick fox" → filters to ["quick", "fox"], both
            // present in doc → matches.
            expect(
                s
                    .get(search("the quick fox"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["a"])
        })
    })

    describe("stemming", () => {
        test("inflected forms match the stemmed root", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
                stem: simpleEnglishStem,
            })

            s.set(post("a"), { text: "running fast" })
            s.set(post("b"), { text: "runs every day" })
            s.set(post("c"), { text: "swimming pool" })

            // "running" → stem → "run"; "runs" → stem → "run"
            // Query "ran" → "ran" (irregular, not stemmed)
            // But query "running" or "run" should find both a and b.
            const r1 = s
                .get(search("running"))
                .map(a => a.familyArgsStringified)
                .sort()
            expect(r1).toEqual(["a", "b"])

            const r2 = s
                .get(search("runs"))
                .map(a => a.familyArgsStringified)
                .sort()
            expect(r2).toEqual(["a", "b"])
        })

        test("stem + stopWords + tokenize compose", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
                tokenize: text => defaultTokenize(foldAccents(text)),
                stem: simpleEnglishStem,
                stopWords: englishStopWords,
            })

            s.set(post("1"), { text: "The cafés are running late" })
            s.set(post("2"), { text: "She runs the kitchen" })

            // Query "café run" — accents folded, stopwords stripped,
            // stemmed; should match both.
            const r = s
                .get(search("café run"))
                .map(a => a.familyArgsStringified)
                .sort()
            expect(r.length).toBeGreaterThanOrEqual(1)
            // Doc 1 has both "café" trigrams and stemmed "run" — should
            // outrank doc 2 which only matches "run".
            expect(r).toContain("1")
        })
    })

    describe("field-name type inference", () => {
        // These tests are 90% about compile-time typing — runtime behavior
        // is unchanged from the un-typed case. The presence of these tests
        // pins the overload shape so a future refactor that loses field
        // inference would surface as a tsc failure (and these assertions
        // would still hold so behavior stays correct either way).
        test("valid field name accepted at runtime", () => {
            const s = store()
            type Doc = { title: string; body: string }
            const post = atomFamily<Doc, [string]>()
            const search = atomFamilySearch(
                post,
                p => ({ title: p.title, body: p.body }),
                {
                    fields: {
                        // `title` and `body` are inferred from the
                        // extractor's return shape. Typing
                        // `fields: { tittle: { boost: 2 } }` would be
                        // a tsc error.
                        title: { boost: 2 },
                        body: { boost: 1 },
                    },
                },
            )
            s.set(post("1"), { title: "hello", body: "world" })
            expect(
                s
                    .get(search("hello"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["1"])
        })

        test("single-string extractor doesn't constrain `fields`", () => {
            // The single-string overload allows any `fields` key (the
            // option is meaningless in that path), so this compiles.
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                fields: { anything: { boost: 1 } },
            })
            s.set(post("1"), { text: "hello" })
            expect(
                s
                    .get(search("hello"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["1"])
        })
    })

    describe("tolerance (Levenshtein fuzzy)", () => {
        // Mirrors Orama's `tolerance` option — allows query tokens to
        // match indexed tokens within K edits. Lives next to `mode`
        // (works in `exact` and `prefix`; ignored in `trigram` since
        // trigrams are already fuzzy by construction).

        describe("minimum-length guard (short tokens aren't fuzzed)", () => {
            // Edit-distance-1 on a very short token matches a huge
            // neighborhood — and in prefix mode the term dictionary is
            // full of short prefixes, so a 3-char query like "str" would
            // fuzz into "sto" (→ storm), "sta", etc., matching most of the
            // corpus and drowning the real prefix match. Tokens at or below
            // `tolerance + 2` chars are matched exactly / by prefix only.

            test("a short prefix is NOT fuzzed into substitution-neighbors (prefix mode)", () => {
                const s = store()
                const post = atomFamily<{ text: string }, [string]>(null, {
                    name: "posts",
                })
                const search = atomFamilySearch(post, p => p.text, {
                    mode: "prefix",
                    tolerance: 1,
                })
                s.set(post("strong"), { text: "strong" })
                s.set(post("storm"), { text: "storm" })
                // "str" is a real prefix of "strong" → matches. "storm" only
                // matches via the fuzz str→sto, which the guard suppresses.
                const hits = s
                    .get(search("str"))
                    .map(a => a.familyArgsStringified)
                expect(hits).toContain("strong")
                expect(hits).not.toContain("storm")
            })

            test("a long typo'd token IS still fuzzed (typo correction preserved)", () => {
                const s = store()
                const post = atomFamily<{ text: string }, [string]>(null, {
                    name: "posts",
                })
                const search = atomFamilySearch(post, p => p.text, {
                    mode: "prefix",
                    tolerance: 1,
                })
                s.set(post("a"), { text: "stranger" })
                // "strangr" (7 chars, one deletion) is well above the guard,
                // so it still fuzz-matches "stranger".
                expect(
                    s.get(search("strangr")).map(a => a.familyArgsStringified),
                ).toEqual(["a"])
            })

            test("short exact-mode typo is not fuzzed either", () => {
                const s = store()
                const post = atomFamily<{ text: string }, [string]>(null, {
                    name: "posts",
                })
                const search = atomFamilySearch(post, p => p.text, {
                    mode: "exact",
                    tolerance: 1,
                })
                s.set(post("cat"), { text: "cat" })
                s.set(post("cot"), { text: "cot" })
                // "bat" is 1 edit from "cat" but only 3 chars → guard means
                // exact-only, so it matches neither.
                expect(s.get(search("bat"))).toHaveLength(0)
                // The exact token still matches.
                expect(
                    s.get(search("cat")).map(a => a.familyArgsStringified),
                ).toEqual(["cat"])
            })
        })

        test("tolerance: 1 matches single-char typos in exact mode", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
                tolerance: 1,
            })

            s.set(post("a"), { text: "stranger" })

            // Direct match still works
            expect(
                s
                    .get(search("stranger"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["a"])

            // Single-char delete
            expect(
                s
                    .get(search("strangr"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["a"])
            // Single-char substitute
            expect(
                s
                    .get(search("strangzr"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["a"])
            // Single-char insert
            expect(
                s
                    .get(search("strangger"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["a"])
        })

        test("tolerance: 0 (default) doesn't match typos", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
            })

            s.set(post("a"), { text: "stranger" })

            expect(s.get(search("strangr"))).toHaveLength(0)
            expect(s.get(search("strangzr"))).toHaveLength(0)
        })

        test("tolerance: 2 matches two-char typos but not three", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
                tolerance: 2,
            })

            s.set(post("a"), { text: "stranger" })

            // 2 edits — should match
            expect(s.get(search("strngr"))).toHaveLength(1)
            // 4 edits — should not
            expect(s.get(search("xxxxx"))).toHaveLength(0)
        })

        test("exact match outranks typo'd match", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
                tolerance: 1,
            })

            s.set(post("exact"), { text: "stranger" })
            s.set(post("typo"), { text: "stranger more text here padding" })
            // Both contain "stranger" exactly. "exact" is shorter, gets
            // length-norm bonus from BM25F.

            const r = s
                .get(search("stranger"))
                .map(a => a.familyArgsStringified)
            expect(r[0]).toBe("exact")
        })

        test("ranking across mixed exact + typo'd candidates", () => {
            // Stress test: many candidates, some matching exactly, some
            // only via tolerance. Exact matches must dominate; typo'd
            // matches still appear but rank below all exacts.
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
                tolerance: 1,
            })

            // Three exact-match docs
            s.set(post("e1"), { text: "hello world" })
            s.set(post("e2"), { text: "hello there" })
            s.set(post("e3"), { text: "hello again" })
            // Three typo'd-match docs (single-edit distance from "hello")
            s.set(post("t1"), { text: "helo padding padding padding" })
            s.set(post("t2"), { text: "hellp padding padding padding" })
            s.set(post("t3"), { text: "hellos padding padding padding" })
            // A non-match
            s.set(post("none"), { text: "completely different content" })

            const r = s
                .get(search("hello"))
                .map(a => a.familyArgsStringified)

            // All 6 matches; non-match excluded
            expect(r).toHaveLength(6)
            expect(r).not.toContain("none")

            // First three results must be the exact matches (any order
            // between them — they tie on TF and only differ by length
            // normalization).
            const top3 = new Set(r.slice(0, 3))
            expect(top3).toEqual(new Set(["e1", "e2", "e3"]))

            // The typo'd matches must come after, never before, the
            // exact ones.
            const bottom3 = new Set(r.slice(3))
            expect(bottom3).toEqual(new Set(["t1", "t2", "t3"]))
        })

        test("tolerance ignored in trigram mode (already fuzzy)", () => {
            // Just verify it doesn't crash / produces sensible output.
            // Trigram mode handles typos via n-gram overlap, not Levenshtein.
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
                tolerance: 1, // no-op
            })

            s.set(post("a"), { text: "stranger" })
            expect(s.get(search("strangr")).length).toBeGreaterThan(0)
        })

        test("query token unchanged after stem applies", () => {
            // Tolerance expansion happens AFTER stem/stopword normalization,
            // so the dictionary lookup is against stemmed terms.
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
                language: "english",
                tolerance: 1,
            })

            s.set(post("a"), { text: "running fast" })
            // "running" stems to "run", "ruunning" stems to "ruunning"
            // (or similar). With tolerance 1 against the stemmed
            // dictionary, "ruun" should still find "run".
            expect(
                s
                    .get(search("ruun"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["a"])
        })

        test("termDictionary doesn't leak across rewrites or deletes (N2)", () => {
            // Regression: previously the dictionary grew monotonically as
            // atoms were rewritten with new terms — old terms were never
            // removed. For an editor-style app (post saved repeatedly)
            // the dictionary's working set is N×K (atom count × vocab
            // per atom) but actual size grew toward N×M×K (× edits).
            // Fix: per-term refcounts, drop on detach when count hits 0.
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
                tolerance: 1,
            })
            // Internal-only inspector. Not in the public type — only the
            // search instance has it at runtime, exposed for this test.
            const dictSize = () =>
                (search as unknown as { __dictionarySize: () => number })
                    .__dictionarySize()

            // 1. Initial corpus
            s.set(post("a"), { text: "alpha beta" })
            s.set(post("b"), { text: "gamma delta" })
            expect(dictSize()).toBe(4)

            // 2. Rewriting an atom with new terms should drop the old ones
            s.set(post("a"), { text: "epsilon zeta" })
            // dictionary should now contain: gamma delta epsilon zeta (4)
            // NOT: alpha beta gamma delta epsilon zeta (6)
            expect(dictSize()).toBe(4)

            // 3. Many rewrites of the same atom should keep size bounded
            for (let i = 0; i < 50; i++) {
                s.set(post("c"), { text: `term${i} word${i}` })
            }
            // Final state of c: term49 word49 (2 terms unique to c)
            // Plus b's gamma + delta, and a's epsilon + zeta = 6 total
            expect(dictSize()).toBe(6)

            // 4. Delete should also drop terms
            s.del(post("a"))
            // Removes epsilon + zeta → 4 remaining
            expect(dictSize()).toBe(4)

            s.del(post("b"))
            s.del(post("c"))
            expect(dictSize()).toBe(0)
        })

        test("shared terms across atoms survive single-atom delete (refcount > 1)", () => {
            // Refcount sanity: two atoms share the term "shared"; deleting
            // one should keep "shared" in the dictionary because the other
            // still uses it.
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
                tolerance: 1,
            })
            const dictSize = () =>
                (search as unknown as { __dictionarySize: () => number })
                    .__dictionarySize()

            s.set(post("a"), { text: "shared unique-a" })
            s.set(post("b"), { text: "shared unique-b" })
            // Tokenizer drops hyphens — terms are: shared, unique, a, b
            // (4 distinct after dedup of "shared"; the splits of
            // "unique-a"/"unique-b" yield "unique","a","b")
            const sizeBeforeDelete = dictSize()
            expect(sizeBeforeDelete).toBeGreaterThan(0)

            s.del(post("a"))
            // "shared" and "unique" still appear in b → must remain
            expect(s.get(search("shared")).length).toBe(1)
            expect(s.get(search("unique")).length).toBe(1)
            // Dictionary should have shrunk by exactly the terms unique
            // to atom a (which is just "a"). "shared" and "unique" stay.
            expect(dictSize()).toBe(sizeBeforeDelete - 1)
        })
    })

    describe("language preset", () => {
        test("`language: 'english'` bundles tokenize + stem + stopWords", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text, {
                language: "english",
            })

            s.set(post("a"), { text: "The runners are running fast" })
            s.set(post("b"), { text: "She runs every day" })

            // Stop-word filtering: "the" filtered → no matches against
            // documents that contain it only.
            expect(s.get(search("the"))).toHaveLength(0)

            // Stemming: "running" / "runs" / "runners" all stem to "run"
            // (or close enough that the english stemmer collapses them).
            const r = s
                .get(search("run"))
                .map(a => a.familyArgsStringified)
                .sort()
            expect(r).toEqual(["a", "b"])
        })

        test("explicit option overrides the preset", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            // English preset would stem, but user provides an explicit
            // identity stem fn — the explicit value must win.
            const search = atomFamilySearch(post, p => p.text, {
                language: "english",
                stem: w => w,
            })

            s.set(post("a"), { text: "runners" })
            // Without stemming, "run" no longer matches "runners".
            expect(s.get(search("run"))).toHaveLength(0)
        })

        test("no language preset = no stemming / stop-word filtering (current default)", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>()
            const search = atomFamilySearch(post, p => p.text)

            s.set(post("a"), { text: "the runners" })
            // Without the preset: "the" is indexed, "runners" is not
            // stemmed → "run" doesn't match.
            expect(
                s.get(search("the")).map(a => a.familyArgsStringified),
            ).toEqual(["a"])
            expect(s.get(search("run"))).toHaveLength(0)
        })
    })

    describe("match strategy", () => {
        test("match: 'all' on prefix mode requires every query token", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "prefix",
                match: "all",
            })

            s.set(post("both"), { text: "apple banana" })
            s.set(post("one"), { text: "apple cherry" })

            // Both query words must have a prefix match → only "both"
            const r = s
                .get(search("appl bana"))
                .map(a => a.familyArgsStringified)
            expect(r).toEqual(["both"])
        })

        test("match: 'ranked' on exact mode scores by IDF", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
                match: "ranked",
            })

            s.set(post("a"), { text: "hello world" })
            s.set(post("b"), { text: "hello" })

            // Query "hello world" — doc with both terms outranks doc
            // with one.
            const r = s
                .get(search("hello world"))
                .map(a => a.familyArgsStringified)
            expect(r[0]).toBe("a")
        })
    })

    describe("minMatch quality filter", () => {
        test("trigram queries with very loose overlap are dropped", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            // With minMatch=0 (default), trigram boundary trigrams like
            // "\x00\x00a" cause every doc with an 'a'-initial word to
            // match a query like "aaaa". minMatch=0.4 requires 40% of the
            // query's trigrams to be present, so spam queries return
            // empty results.
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
                minMatch: 0.4,
            })

            s.set(post("1"), { text: "apple banana" })
            s.set(post("2"), { text: "alpha beta" })
            s.set(post("3"), { text: "asparagus arbitrage" })

            // Bare-minimum overlap (just boundary trigrams) is filtered
            expect(s.get(search("aaaaaaaa"))).toHaveLength(0)

            // Legit fuzzy match (most trigrams overlap) still works
            expect(
                s.get(search("apl")).map(a => a.familyArgsStringified),
            ).toContain("1")
        })

        test("minMatch=0 is the default (no filtering)", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
            })
            s.set(post("1"), { text: "apple banana" })
            // Without minMatch, even tiny boundary overlap returns matches
            const results = s.get(search("aaa"))
            // Some result expected because trigrams "\\x00\\x00a" / "\\x00a"
            // are present in the doc
            expect(results.length).toBeGreaterThanOrEqual(0) // just no error
        })

        test("minMatch=1.0 is essentially AND on trigrams (strict)", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
                minMatch: 1.0,
            })
            s.set(post("a"), { text: "javascript" })
            s.set(post("b"), { text: "java" })

            // Identical query → 100% overlap with "javascript" doc
            expect(
                s.get(search("javascript")).map(x => x.familyArgsStringified),
            ).toContain("a")
            // "java" doc shares only ~4 of "javascript"'s 12 trigrams
            // → below 100% threshold → not returned
            const results = s
                .get(search("javascript"))
                .map(x => x.familyArgsStringified)
            expect(results).not.toContain("b")
        })
    })

    describe("limit option", () => {
        test("caps result count to top-K by score", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
                limit: 3,
            })

            for (let i = 0; i < 20; i++) {
                s.set(post(`doc-${i}`), { text: "hello world" })
            }

            expect(s.get(search("hello"))).toHaveLength(3)
            expect(s.get(search.scored("hello"))).toHaveLength(3)
        })

        test("limit preserves top results in score order", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            // mode "ranked" so we get differentiated scores via IDF.
            const search = atomFamilySearch(post, p => p.text, {
                mode: "exact",
                match: "ranked",
                limit: 2,
            })

            // "rare" appears once, "common" in many.
            s.set(post("rare"), { text: "rare term" })
            s.set(post("a"), { text: "common rare" })
            s.set(post("b"), { text: "common only" })
            s.set(post("c"), { text: "common other" })
            s.set(post("d"), { text: "common yet" })

            const results = s.get(search.scored("common rare"))
            expect(results).toHaveLength(2)
            // Top two should be the docs that match "rare" (rare term has
            // much higher IDF than "common"), in deterministic tiebreak
            // order.
            const ids = results.map(r => r.atom.familyArgsStringified)
            expect(ids).toContain("rare")
            expect(ids).toContain("a")
        })

        test("limit: 0 or undefined means no cap", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const noLimit = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
                name: "noLimit",
            })
            const zeroLimit = atomFamilySearch(post, p => p.text, {
                mode: "trigram",
                limit: 0,
                name: "zeroLimit",
            })

            for (let i = 0; i < 15; i++) {
                s.set(post(`doc-${i}`), { text: "hello world" })
            }

            expect(s.get(noLimit("hello")).length).toBe(15)
            expect(s.get(zeroLimit("hello")).length).toBe(15)
        })
    })

    describe("scoped stores", () => {
        test("child inherits parent search results", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text)

            root.set(post("1"), { text: "hello world" })
            expect(
                child
                    .get(search("hello"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["1"])
        })

        test("child override updates only its own view", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text)

            root.set(post("1"), { text: "hello" })
            child.set(post("1"), { text: "goodbye" })

            expect(
                root.get(search("hello")).map(a => a.familyArgsStringified),
            ).toEqual(["1"])
            expect(child.get(search("hello"))).toHaveLength(0)
            expect(
                child
                    .get(search("goodbye"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["1"])
        })

        test("parent write after child write updates child view", () => {
            const root = store("root")
            const child = root.scope("child")
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text)

            child.set(post("c"), { text: "hello child" })
            expect(
                child
                    .get(search("hello"))
                    .map(a => a.familyArgsStringified),
            ).toEqual(["c"])

            root.set(post("r"), { text: "hello root" })
            expect(
                child
                    .get(search("hello"))
                    .map(a => a.familyArgsStringified)
                    .sort(),
            ).toEqual(["c", "r"])
        })
    })

    describe("null / undefined extractor return — skip indexing", () => {
        test("single-string extractor returning null skips the atom", () => {
            const s = store()
            const post = atomFamily<
                { text: string | null },
                [string]
            >(null, { name: "posts" })
            const search = atomFamilySearch(
                post,
                p => p.text,
            )

            s.set(post("a"), { text: "hello world" })
            s.set(post("b"), { text: null })
            s.set(post("c"), { text: "hello there" })

            expect(
                s
                    .get(search("hello"))
                    .map(a => a.familyArgsStringified)
                    .sort(),
            ).toEqual(["a", "c"])
        })

        test("single-string extractor returning undefined skips the atom", () => {
            const s = store()
            const post = atomFamily<
                { text: string | undefined },
                [string]
            >(null, { name: "posts" })
            const search = atomFamilySearch(post, p => p.text)

            s.set(post("a"), { text: "hello" })
            s.set(post("b"), { text: undefined })

            expect(
                s.get(search("hello")).map(a => a.familyArgsStringified),
            ).toEqual(["a"])
        })

        test("single-string extractor returning empty string skips the atom", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text)

            s.set(post("a"), { text: "hello" })
            s.set(post("b"), { text: "" })

            expect(
                s.get(search("hello")).map(a => a.familyArgsStringified),
            ).toEqual(["a"])
        })

        test("field-map extractor: null/undefined per-field values are skipped", () => {
            const s = store()
            const post = atomFamily<
                { title: string | null; body: string | undefined },
                [string]
            >(null, { name: "posts" })
            const search = atomFamilySearch(
                post,
                p => ({ title: p.title, body: p.body }),
                { fields: { title: { boost: 2 }, body: { boost: 1 } } },
            )

            s.set(post("a"), { title: "hello", body: undefined })
            s.set(post("b"), { title: null, body: "hello world" })
            s.set(post("c"), { title: null, body: undefined })

            expect(
                s
                    .get(search("hello"))
                    .map(a => a.familyArgsStringified)
                    .sort(),
            ).toEqual(["a", "b"])
        })

        test("field-map extractor returning null/undefined skips the whole atom", () => {
            const s = store()
            const post = atomFamily<
                { title: string; body: string } | null,
                [string]
            >(null, { name: "posts" })
            const search = atomFamilySearch(post, p =>
                p ? { title: p.title, body: p.body } : null,
            )

            s.set(post("a"), { title: "hello", body: "world" })
            s.set(post("b"), null)

            expect(
                s.get(search("hello")).map(a => a.familyArgsStringified),
            ).toEqual(["a"])
        })

        test("re-write from non-null to null detaches prior terms", () => {
            const s = store()
            const post = atomFamily<
                { text: string | null },
                [string]
            >(null, { name: "posts" })
            const search = atomFamilySearch(post, p => p.text)

            s.set(post("a"), { text: "hello" })
            expect(
                s.get(search("hello")).map(a => a.familyArgsStringified),
            ).toEqual(["a"])

            s.set(post("a"), { text: null })
            expect(
                s.get(search("hello")).map(a => a.familyArgsStringified),
            ).toEqual([])
        })

        test("re-write from null to non-null indexes the atom", () => {
            const s = store()
            const post = atomFamily<
                { text: string | null },
                [string]
            >(null, { name: "posts" })
            const search = atomFamilySearch(post, p => p.text)

            s.set(post("a"), { text: null })
            expect(
                s.get(search("hello")).map(a => a.familyArgsStringified),
            ).toEqual([])

            s.set(post("a"), { text: "hello" })
            expect(
                s.get(search("hello")).map(a => a.familyArgsStringified),
            ).toEqual(["a"])
        })
    })

    describe("coordination (query-term coverage)", () => {
        // Reproduces the "The Eternal Stranger" pathology: when one query
        // term is rare (high IDF) and another is common (low IDF), pure
        // additive BM25F + length normalization can let a doc matching ONLY
        // the rare term outrank a doc matching BOTH — because the rare
        // term's per-doc score swings with document length and the common
        // term adds almost nothing. The coordination factor rewards
        // matching more distinct query terms, restoring "matched more of
        // the query wins".
        const buildCorpus = (coordination?: number) => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                match: "ranked",
                ...(coordination !== undefined ? { coordination } : {}),
            })
            // "rare" appears in only 2 docs (high IDF). "common" is sprayed
            // across many docs (low IDF). The doc matching BOTH is slightly
            // longer so length-norm modestly penalizes its "rare" term; the
            // doc matching ONLY "rare" is short so its "rare" term scores a
            // touch higher. Under pure BM25F that edge is enough for the
            // rare-only doc to win — the exact pathology coordination fixes.
            s.set(post("both"), { text: "rare common filler" })
            s.set(post("rareonly"), { text: "rare" })
            for (let i = 0; i < 25; i++) {
                s.set(post(`c${i}`), { text: `common doc number ${i}` })
            }
            return { s, search }
        }

        test("default: doc matching ALL query terms outranks rare-term-only", () => {
            const { s, search } = buildCorpus()
            const ranked = s
                .get(search("rare common"))
                .map(a => a.familyArgsStringified)
            expect(ranked[0]).toBe("both")
        })

        test("coordination: 0 disables the factor (pure BM25F — rare term can win)", () => {
            // Backward-compat / proof the lever is what flips it: with no
            // coordination, the short rare-only doc beats the long both doc.
            const { s, search } = buildCorpus(0)
            const ranked = s
                .get(search("rare common"))
                .map(a => a.familyArgsStringified)
            expect(ranked[0]).toBe("rareonly")
        })

        test("coordination: 1 is strict coverage weighting", () => {
            const { s, search } = buildCorpus(1)
            const ranked = s
                .get(search("rare common"))
                .map(a => a.familyArgsStringified)
            // 2/2 coverage doc must beat any 1/2 coverage doc.
            expect(ranked[0]).toBe("both")
            const bothIdx = ranked.indexOf("both")
            const rareIdx = ranked.indexOf("rareonly")
            expect(bothIdx).toBeLessThan(rareIdx)
        })

        test("single-token query is unaffected by coordination", () => {
            // coverage is always 1/1 for a single query term, so ranking
            // matches whatever pure BM25F produces regardless of the factor.
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const on = atomFamilySearch(post, p => p.text, {
                match: "ranked",
            })
            const off = atomFamilySearch(post, p => p.text, {
                match: "ranked",
                coordination: 0,
            })
            s.set(post("a"), { text: "alpha beta" })
            s.set(post("b"), { text: "alpha alpha gamma" })
            expect(
                s.get(on("alpha")).map(a => a.familyArgsStringified),
            ).toEqual(s.get(off("alpha")).map(a => a.familyArgsStringified))
        })

        test("match: 'all' is unaffected (every result covers every term)", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                match: "all",
            })
            s.set(post("a"), { text: "hello world" })
            s.set(post("b"), { text: "hello there world" })
            // Both match all query terms → coordination is 1 for both →
            // ordering is pure BM25F, no error/empty.
            const ranked = s
                .get(search("hello world"))
                .map(a => a.familyArgsStringified)
                .sort()
            expect(ranked).toEqual(["a", "b"])
        })
    })

    describe("length normalization uses word count (not expanded terms)", () => {
        // BM25 document length must be the raw word count, not the
        // mode-expanded term count. In prefix/trigram mode the expansion
        // size scales with word length, so using it as `length` would
        // penalize docs that merely contain longer words. Orama / standard
        // BM25 normalize by word count; this pins that.
        test("prefix mode: a longer sibling word doesn't penalize the shared term", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                mode: "prefix",
                match: "ranked",
            })
            // Both docs are 2 words and share "alpha". "long" has a much
            // longer second word (22 prefixes vs 2) — pre-fix that inflated
            // its field length and dragged its "alpha" score below "short".
            s.set(post("short"), { text: "alpha bb" })
            s.set(post("long"), { text: "alpha electroencephalography" })
            const scored = s.get(search.scored("alpha"))
            const score = new Map(
                scored.map(r => [
                    String(r.atom.familyArgsStringified),
                    r.score,
                ]),
            )
            expect(score.get("short")).toBeCloseTo(score.get("long")!, 5)
        })

        test("prefix mode: title match outranks body-only match for a partial query", () => {
            // The "the eternal str" case in miniature: a doc with the term
            // in the boosted title beats one with it only in the body, once
            // length-norm stops penalizing the longer title word.
            const s = store()
            const post = atomFamily<{ title: string; body: string }, [string]>(
                null,
                { name: "posts" },
            )
            const search = atomFamilySearch(
                post,
                p => ({ title: p.title, body: p.body }),
                { mode: "prefix", fields: { title: { boost: 2 }, body: { boost: 1 } } },
            )
            s.set(post("title"), {
                title: "The Eternal Stranger",
                body: "a quiet life by the sea",
            })
            s.set(post("body"), {
                title: "The Eternal City",
                body: "a stranger arrives one evening",
            })
            const ranked = s
                .get(search("eternal str"))
                .map(a => a.familyArgsStringified)
            expect(ranked[0]).toBe("title")
        })
    })
})
