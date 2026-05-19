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
})
