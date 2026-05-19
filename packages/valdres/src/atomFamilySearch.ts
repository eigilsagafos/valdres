import { atomFamilyIndex } from "./atomFamilyIndex"
import { trigramsOf } from "./lib/trigramsOf"
import { selector } from "./selector"
import type { Atom } from "./types/Atom"
import type { AtomFamily } from "./types/AtomFamily"
import type { AtomFamilyAtom } from "./types/AtomFamilyAtom"
import type { Selector } from "./types/Selector"
import { defaultTokenize } from "./utils/defaultTokenize"
import { englishStopWords } from "./utils/englishStopWords"

/**
 * Search strategy.
 *
 *  - `"exact"` (default): the indexed term is the token itself. Defaults
 *    to AND intersection — every query token must appear. Backward
 *    compatible.
 *  - `"prefix"`: index every prefix of each token. Query tokens act as
 *    prefix lookups. Defaults to ranked-OR.
 *  - `"trigram"`: index 3-char n-grams with boundary markers. Typo-
 *    tolerant and partial-word friendly. Defaults to ranked-OR.
 *
 * The default scoring (for ranked-OR) is summed IDF over matched
 * query terms: rare terms contribute more, common terms less, mirroring
 * the IDF half of BM25 without per-document term-frequency tracking.
 */
export type SearchMode = "exact" | "prefix" | "trigram"

/**
 * Combining strategy across query terms.
 *
 *  - `"all"`: every query term must be present (AND intersection).
 *  - `"ranked"`: any matched term contributes to the score; results
 *    ordered by IDF-weighted relevance. Tie-broken deterministically by
 *    `familyArgsStringified` for stable output across writes.
 */
export type MatchStrategy = "all" | "ranked"

export type AtomFamilySearchOptions = {
    /** Search strategy. Default: `"exact"`. */
    mode?: SearchMode
    /** AND vs ranked-OR combining. Default depends on `mode`:
     *  `"all"` for exact, `"ranked"` for prefix/trigram. */
    match?: MatchStrategy
    /** Base word splitter. Default: lowercase + Unicode word-split. */
    tokenize?: (text: string) => string[]
    /** Optional stemmer applied after tokenization, before mode expansion.
     *  Try `simpleEnglishStem` from this package, or plug in a more
     *  capable Porter / Snowball implementation. */
    stem?: (word: string) => string
    /** Tokens matching this set are dropped before indexing and querying.
     *  Pass `englishStopWords` from this package for a default list,
     *  any custom `Set<string>` / `ReadonlySet<string>`, or `true` to use
     *  the English defaults. */
    stopWords?: ReadonlySet<string> | true
    /** Minimum fraction of query terms that a doc must match to be
     *  returned. Range [0, 1]; default `0` = no filter.
     *
     *  Most useful for `trigram` mode, where boundary trigrams (e.g.
     *  `"\\x00\\x00a"`) are very common and a query like `"aaaa"` would
     *  otherwise match every doc containing any word starting with `a`.
     *  A value around `0.3`–`0.5` filters out documents with only
     *  incidental overlap while still tolerating typos. */
    minMatch?: number
    /** Cap returned results to the top-N by score. Mirrors what most JS
     *  search libraries do by default — `MiniSearch.search()` does not
     *  cap, FlexSearch defaults to 100, Orama defaults to 10. Without a
     *  limit, trigram-mode queries can return long tails of incidental
     *  matches even when the top-K are the only relevant results. */
    limit?: number
    name?: string
}

export type ScoredResult<Value, Args extends [any, ...any[]]> = {
    atom: AtomFamilyAtom<Value, Args>
    score: number
    /** Normalized query tokens (post stopword + stem) that contributed to
     *  this result's score. Useful for highlighting which user-typed
     *  words found this document. For trigram mode this is the *token*
     *  the user wrote, not the underlying trigrams. */
    matched: string[]
}

export type AtomFamilySearch<Value, Args extends [any, ...any[]]> = {
    /** Returns a selector resolving to matching atoms, in ranking order
     *  for `match: "ranked"` strategies. */
    (query: string): Selector<AtomFamilyAtom<Value, Args>[]>
    /** Returns a selector resolving to `{ atom, score }` pairs in ranking
     *  order. Score is summed IDF over matched query terms. */
    scored(query: string): Selector<ScoredResult<Value, Args>[]>
    /** Drop the cached selectors for one query string. The next call
     *  with the same query allocates fresh selectors — useful when an
     *  app issues many distinct queries (e.g. search-as-you-type) and
     *  doesn't want the cache to grow without bound. Returns `true` if
     *  a cache entry existed. */
    releaseQuery(query: string): boolean
    /** Drop every cached query selector. Next read of any query
     *  allocates fresh selectors. */
    releaseAllQueries(): void
}

const expandForWrite = (
    tokens: string[],
    mode: SearchMode,
): string[] => {
    if (mode === "exact") return tokens
    if (mode === "prefix") {
        // Inline equivalent of `tokens.flatMap(prefixesOf)` — for bulk
        // inserts this saves an intermediate sub-array per token plus the
        // flat-map walk. Identical output.
        const out: string[] = []
        for (let ti = 0; ti < tokens.length; ti++) {
            const tok = tokens[ti]
            const len = tok.length
            for (let i = 1; i <= len; i++) out.push(tok.slice(0, i))
        }
        return out
    }
    // Inline trigram emission, matches `tokens.flatMap(trigramsOf)`.
    // Each token produces `tok.length + 2` trigrams with the two-char
    // boundary marker.
    const out: string[] = []
    for (let ti = 0; ti < tokens.length; ti++) {
        const tok = tokens[ti]
        if (tok.length === 0) continue
        const padded = `\x00\x00${tok}\x00\x00`
        const end = padded.length - 2
        for (let i = 0; i < end; i++) out.push(padded.slice(i, i + 3))
    }
    return out
}


const resolveStopWords = (
    opt: ReadonlySet<string> | true | undefined,
): ReadonlySet<string> | null => {
    if (opt === undefined) return null
    if (opt === true) return englishStopWords
    return opt
}

/**
 * Inverted-index text search over an atomFamily — feature set on par
 * with general-purpose JS in-memory search libraries:
 *
 *  - Three modes (`exact`, `prefix`, `trigram`) for strict / autocomplete
 *    / typo-tolerant matching.
 *  - Plug-in tokenizer, stemmer, and stop-word list.
 *  - AND or ranked-OR combining; ranked-OR uses IDF-weighted scoring.
 *  - `searchInstance.scored(query)` exposes per-result scores for
 *    relevance display.
 *  - Scope-aware (cross-scope propagation inherited from
 *    `atomFamilyIndex`).
 *
 * Composition pattern for accent-insensitive matching:
 *
 *   import { atomFamilySearch, defaultTokenize, foldAccents, simpleEnglishStem, englishStopWords }
 *       from "valdres"
 *
 *   atomFamilySearch(posts, p => `${p.title} ${p.body}`, {
 *       mode: "trigram",
 *       tokenize: text => defaultTokenize(foldAccents(text)),
 *       stem: simpleEnglishStem,
 *       stopWords: englishStopWords,
 *   })
 */
export const atomFamilySearch = <
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    family: AtomFamily<Value, Args>,
    extractor: (value: Value) => string,
    options?: AtomFamilySearchOptions,
): AtomFamilySearch<Value, Args> => {
    const mode: SearchMode = options?.mode ?? "exact"
    const matchStrategy: MatchStrategy =
        options?.match ?? (mode === "exact" ? "all" : "ranked")
    const baseTokenize = options?.tokenize ?? defaultTokenize
    const stem = options?.stem
    const stopWords = resolveStopWords(options?.stopWords)

    const normalize = (text: string): string[] => {
        let tokens = baseTokenize(text)
        if (stopWords) tokens = tokens.filter(t => !stopWords.has(t))
        if (stem) {
            const out: string[] = []
            for (const t of tokens) {
                const s = stem(t)
                if (s.length > 0) out.push(s)
            }
            tokens = out
        }
        return tokens
    }

    const tokenIndex = atomFamilyIndex(
        family,
        value => expandForWrite(normalize(extractor(value)), mode),
        { name: options?.name },
    )

    type TokenSetEntry = {
        array: AtomFamilyAtom<Value, Args>[]
        set: Set<AtomFamilyAtom<Value, Args>>
    }
    const tokenSetCache = new Map<string, TokenSetEntry>()

    const getTokenSet = (
        token: string,
        get: <V>(state: Atom<V>) => V,
    ): Set<AtomFamilyAtom<Value, Args>> => {
        const arr = get(tokenIndex(token))
        const cached = tokenSetCache.get(token)
        if (cached && cached.array === arr) return cached.set
        const set = new Set(arr)
        tokenSetCache.set(token, { array: arr, set })
        return set
    }

    const scoredCache = new Map<
        string,
        Selector<ScoredResult<Value, Args>[]>
    >()
    const atomsCache = new Map<
        string,
        Selector<AtomFamilyAtom<Value, Args>[]>
    >()

    const expandSingleToken = (token: string): string[] => {
        if (mode === "exact" || mode === "prefix") return [token]
        return trigramsOf(token)
    }

    const minMatchFraction = Math.max(0, Math.min(1, options?.minMatch ?? 0))
    const resultLimit =
        options?.limit !== undefined && options.limit > 0
            ? Math.floor(options.limit)
            : Infinity

    const computeScored = (query: string) => {
        const queryTokens = normalize(query)
        const queryName = options?.name
            ? `${options.name}:scored:${query}`
            : undefined

        return selector<ScoredResult<Value, Args>[]>(
            get => {
                if (queryTokens.length === 0) return []
                const typedGet = get as <V>(s: Atom<V>) => V
                const N = Math.max(family.__valdresAtomFamilyMap.size, 1)

                // Per-query-token aggregation: which atoms matched this
                // token, and what's the IDF contribution per match.
                // We accumulate score and `matched` together so the
                // highlighting metadata reflects the token the user
                // typed, not its mode-expanded terms.
                const scores = new Map<AtomFamilyAtom<Value, Args>, number>()
                const matched = new Map<
                    AtomFamilyAtom<Value, Args>,
                    Set<string>
                >()
                // For "all" mode, also track per-token match set so we
                // can intersect at the end.
                const perTokenSets:
                    | Set<AtomFamilyAtom<Value, Args>>[]
                    | undefined =
                    matchStrategy === "all" ? [] : undefined
                // Term-level match count per atom — used to apply the
                // `minMatch` quality filter after the scoring pass.
                const termMatchCount = new Map<
                    AtomFamilyAtom<Value, Args>,
                    number
                >()
                let totalQueryTerms = 0

                for (const queryToken of queryTokens) {
                    const terms = expandSingleToken(queryToken)
                    totalQueryTerms += terms.length
                    const tokenMatched = new Set<AtomFamilyAtom<Value, Args>>()
                    for (const term of terms) {
                        const bucket = getTokenSet(term, typedGet)
                        if (bucket.size === 0) continue
                        const idf = Math.log(1 + N / (1 + bucket.size))
                        for (const atom of bucket) {
                            scores.set(
                                atom,
                                (scores.get(atom) ?? 0) + idf,
                            )
                            termMatchCount.set(
                                atom,
                                (termMatchCount.get(atom) ?? 0) + 1,
                            )
                            tokenMatched.add(atom)
                        }
                    }
                    // AND short-circuit: no atom matched this required
                    // token → empty result.
                    if (matchStrategy === "all" && tokenMatched.size === 0) {
                        return []
                    }
                    for (const atom of tokenMatched) {
                        let set = matched.get(atom)
                        if (!set) {
                            set = new Set()
                            matched.set(atom, set)
                        }
                        set.add(queryToken)
                    }
                    if (perTokenSets) perTokenSets.push(tokenMatched)
                }

                // Filter by AND intersection when match=all.
                let candidates: Iterable<AtomFamilyAtom<Value, Args>>
                if (perTokenSets && perTokenSets.length > 0) {
                    let smallestIdx = 0
                    for (let i = 1; i < perTokenSets.length; i++) {
                        if (
                            perTokenSets[i].size <
                            perTokenSets[smallestIdx].size
                        ) {
                            smallestIdx = i
                        }
                    }
                    const intersected: AtomFamilyAtom<Value, Args>[] = []
                    outer: for (const atom of perTokenSets[smallestIdx]) {
                        for (let i = 0; i < perTokenSets.length; i++) {
                            if (i === smallestIdx) continue
                            if (!perTokenSets[i].has(atom)) continue outer
                        }
                        intersected.push(atom)
                    }
                    candidates = intersected
                } else {
                    candidates = scores.keys()
                }

                // Apply minMatch threshold: drop atoms that didn't match
                // a meaningful fraction of the expanded query terms. This
                // is the lever that prevents trigram mode from returning
                // every doc with even an incidental boundary trigram
                // match.
                const minMatchCount =
                    minMatchFraction > 0 && totalQueryTerms > 0
                        ? Math.max(
                              1,
                              Math.ceil(totalQueryTerms * minMatchFraction),
                          )
                        : 0

                const entries: ScoredResult<Value, Args>[] = []
                for (const atom of candidates) {
                    if (minMatchCount > 0) {
                        const c = termMatchCount.get(atom) ?? 0
                        if (c < minMatchCount) continue
                    }
                    entries.push({
                        atom,
                        score: scores.get(atom) ?? 0,
                        matched: [...(matched.get(atom) ?? [])],
                    })
                }
                if (entries.length === 0) return entries
                entries.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score
                    const sa = String(a.atom.familyArgsStringified)
                    const sb = String(b.atom.familyArgsStringified)
                    return sa < sb ? -1 : sa > sb ? 1 : 0
                })
                if (
                    Number.isFinite(resultLimit) &&
                    entries.length > resultLimit
                ) {
                    entries.length = resultLimit
                }
                return entries
            },
            queryName ? { name: queryName } : undefined,
        )
    }

    const getScored = (query: string) => {
        const cached = scoredCache.get(query)
        if (cached) return cached
        const sel = computeScored(query)
        scoredCache.set(query, sel)
        return sel
    }

    const getAtoms = (query: string) => {
        const cached = atomsCache.get(query)
        if (cached) return cached
        const scoredSel = getScored(query)
        const queryName = options?.name
            ? `${options.name}:${query}`
            : undefined
        const sel = selector<AtomFamilyAtom<Value, Args>[]>(
            get => {
                const scored = get(scoredSel)
                const out = new Array<AtomFamilyAtom<Value, Args>>(scored.length)
                for (let i = 0; i < scored.length; i++) out[i] = scored[i].atom
                return out
            },
            queryName ? { name: queryName } : undefined,
        )
        atomsCache.set(query, sel)
        return sel
    }

    const result: AtomFamilySearch<Value, Args> = ((query: string) =>
        getAtoms(query)) as AtomFamilySearch<Value, Args>
    result.scored = getScored
    result.releaseQuery = (query: string): boolean => {
        const hadScored = scoredCache.delete(query)
        const hadAtoms = atomsCache.delete(query)
        return hadScored || hadAtoms
    }
    result.releaseAllQueries = (): void => {
        scoredCache.clear()
        atomsCache.clear()
    }
    return result
}
