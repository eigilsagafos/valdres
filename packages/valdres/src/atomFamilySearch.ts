import { createBKTree, type BKTree } from "./lib/BKTree"
import {
    bm25Idf,
    bm25ScoreWithIdf,
    DEFAULT_BM25,
    type BM25Params,
} from "./lib/bm25"
import { createLRU } from "./lib/createLRU"
import { createSearchDescriptor } from "./lib/createSearchDescriptor"
import { wandTopK, type WandTerm } from "./lib/wandTopK"
import { levenshtein } from "./lib/levenshtein"
import { trigramsOf } from "./lib/trigramsOf"
import { selector } from "./selector"
import type { Atom } from "./types/Atom"
import type { AtomFamily } from "./types/AtomFamily"
import type { AtomFamilyAtom } from "./types/AtomFamilyAtom"
import type { Selector } from "./types/Selector"
import { defaultTokenize } from "./utils/defaultTokenize"
import { englishStopWords } from "./utils/englishStopWords"
import {
    highlightMatches,
    type HighlightRange,
} from "./utils/highlightMatches"
import { simpleEnglishStem } from "./utils/simpleEnglishStem"

/**
 * Search strategy.
 *
 *  - `"exact"` (default): the indexed term is the whole token. Defaults to
 *    AND intersection — every query token must appear.
 *  - `"prefix"`: indexes whole words (same as exact); a query token matches
 *    every indexed word it prefixes, resolved at query time via the
 *    vocabulary scan (Lucene-style prefix → OR of term queries). Defaults
 *    to ranked-OR.
 *  - `"trigram"`: index 3-char n-grams with boundary markers. Typo-
 *    tolerant and partial-word friendly. Defaults to ranked-OR.
 *
 * Scoring is BM25F across all modes — per-field term frequency, length
 * normalization, and field boosts — with a coordination factor that rewards
 * query-term coverage. See `atomFamilySearchOptions.bm25` / `coordination`.
 */
export type SearchMode = "exact" | "prefix" | "trigram"

/**
 * Combining strategy across query terms.
 *
 *  - `"all"`: every query term must be present (AND intersection).
 *  - `"ranked"`: any matched term contributes to the score; results
 *    ordered by BM25F relevance. Tie-broken deterministically by
 *    `familyArgsStringified` for stable output across writes.
 */
export type MatchStrategy = "all" | "ranked"

/** Built-in language preset name. Only English ships in core (it's the
 *  zero-install default); other languages are imported as
 *  `LanguagePreset` objects from `@valdres/search-languages` and passed
 *  directly via `language: french`. */
export type SearchLanguage = "english"

/** A bundle of language-specific text-processing functions.
 *
 *  `@valdres/search-languages` exports one of these per supported
 *  language. Users can also hand-craft a preset to plug in a custom
 *  tokenizer / stemmer / stop-word list (e.g. a domain-specific
 *  stemmer for medical or legal text). */
export type LanguagePreset = {
    tokenize: (text: string) => string[]
    stem: (word: string) => string
    stopWords: ReadonlySet<string>
}

const LANGUAGE_PRESETS: Record<SearchLanguage, LanguagePreset> = {
    english: {
        tokenize: defaultTokenize,
        stem: simpleEnglishStem,
        stopWords: englishStopWords,
    },
}

export type AtomFamilySearchOptions<
    Fields extends string = string,
    Value = any,
> = {
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
    /** Coordination factor — how strongly to reward documents that match
     *  MORE of the distinct query terms. Range [0, 1]; default `0.5`.
     *
     *  Pure BM25F sums each query term's score independently, so a query
     *  like `"eternal stranger"` can rank a doc matching only the rare,
     *  high-IDF term (`eternal`) above a doc matching BOTH — the common
     *  term (`stranger`) adds too little to compensate, and per-document
     *  length normalization swings the rare term's score. Coordination
     *  fixes that "matched more of the query should win" intuition (the
     *  same role as Lucene's `coord`).
     *
     *  The summed score is multiplied by
     *  `(1 - coordination) + coordination * (matchedTerms / queryTerms)`:
     *   - `0` → off (pure additive BM25F; previous behavior).
     *   - `1` → strict coverage weighting (a doc covering 2/2 query terms
     *     is scaled ×1, one covering 1/2 is scaled ×0.5).
     *   - `0.5` (default) → a gentle blend that reliably floats
     *     full-coverage matches to the top without zeroing partial ones.
     *
     *  No effect on single-term queries or `match: "all"` (coverage is
     *  always 1 there). Tolerance-matched terms count toward coverage. */
    coordination?: number
    /** Upper bound on how many distinct query strings keep cached selectors
     *  (one entry each for the atoms view and the scored view). The
     *  least-recently-used query is evicted past this. Default `500`. Pass
     *  `0` or `Infinity` for an unbounded cache (the previous behavior, with
     *  `releaseQuery` as the only reclaim).
     *
     *  Sized for search-as-you-type, where every keystroke is a distinct
     *  query: the cache used to grow without limit. Eviction only drops the
     *  cache entry — a selector still subscribed elsewhere keeps working;
     *  the next read of an evicted query re-allocates. */
    queryCacheSize?: number
    /** Cap returned results to the top-N by score. Mirrors what most JS
     *  search libraries do by default — `MiniSearch.search()` does not
     *  cap, FlexSearch defaults to 100, Orama defaults to 10. Without a
     *  limit, trigram-mode queries can return long tails of incidental
     *  matches even when the top-K are the only relevant results. */
    limit?: number
    /** Maximum Levenshtein edit distance allowed between a query token
     *  and any indexed token it can match. Mirrors Orama's
     *  `tolerance` parameter — typos are tolerated up to K character
     *  edits (insert / delete / substitute). 0 = exact match only
     *  (default). 1 = single-typo tolerance (most common). 2 = two
     *  typos allowed; usable for shorter / pithier queries.
     *
     *  Only applies in `exact` and `prefix` modes — silently ignored
     *  in `trigram` mode, which handles fuzzy matching via n-gram
     *  overlap instead. Trigram + tolerance would double-fuzzy: not
     *  meaningful, and meaningfully slow.
     *
     *  Cost: O(vocab) per query token. For ~10k vocab + tolerance: 1,
     *  expect a few ms of overhead per query. Fine for live UIs at
     *  modest corpus sizes. */
    tolerance?: number
    /** Language preset — bundles a sensible `tokenize` + `stem` +
     *  `stopWords`. Accepts either the built-in string `"english"` (no
     *  extra install) or a `LanguagePreset` object imported from
     *  `@valdres/search-languages`:
     *
     *      import { french } from "@valdres/search-languages"
     *      atomFamilySearch(family, extract, { language: french })
     *
     *  Explicit `tokenize` / `stem` / `stopWords` options still win when
     *  passed alongside `language`, so users can swap any single piece
     *  while keeping the rest of the preset. */
    language?: SearchLanguage | LanguagePreset
    /** Maintain a positional index — the position of each word within each
     *  field — so double-quoted phrases in a query become adjacency
     *  constraints (`"exact phrase"` matches only docs where those words
     *  appear consecutively, in order, within one field).
     *
     *  Default `false` (positions cost extra memory). Only meaningful in
     *  `exact` / `prefix` mode (phrases are whole-word; trigram has no whole
     *  words). Without it, double quotes are treated as punctuation and the
     *  quoted words are matched independently. */
    positions?: boolean
    /** BM25 tuning knobs. Defaults match Orama's defaults (`k1: 1.2`,
     *  `b: 0.75`, `d: 0.5`) — the BM25+ recommendations. Most apps never
     *  touch this. */
    bm25?: Partial<BM25Params>
    /** Per-field configuration (currently just `boost`). Required when the
     *  extractor returns a field map; defaults to `boost: 1` per field if
     *  not provided.
     *
     *  Field names are type-checked against the extractor's return
     *  shape: when the extractor returns `(v) => ({ title, body })`,
     *  passing `fields: { tittle: { boost: 2 } }` (typo) is a compile
     *  error. Inspired by Orama's schema-first field typing. */
    fields?: { [K in Fields]?: { boost?: number } }
    /** Maps a document to its facet assignments — a record of facet field
     *  name → value (or values). Enables `search(query, { filter })` to
     *  restrict results by facet value, and `search.facets(query, fields?)`
     *  to count matches per value. Separate from the search-text `extractor`:
     *  facets are exact categorical values (category, tags, author), not
     *  tokenized text. Return `null` / `undefined` (or omit a field) to give
     *  a document no value for that facet.
     *
     *      atomFamilySearch(posts, p => p.body, {
     *          facets: p => ({ category: p.category, tags: p.tags }),
     *      })
     *      s.get(search("query", { filter: { category: "books" } }))
     *      s.get(search.facets("query", ["category"]))  // { category: {...} }
     */
    facets?: (
        value: Value,
    ) => Record<string, string | string[]> | null | undefined
    name?: string
}

/** Internal field name used when the extractor returns a single string
 *  (the one-field shape). Never user-facing. */
const DEFAULT_FIELD = "__default__"

/** Output of the extractor normalization, per field: the mode-expanded
 *  term frequencies (term → occurrence count), the raw word count for length
 *  normalization, and (when enabled) the per-word positions for phrase
 *  queries. Fed to `createSearchDescriptor` as the per-(atom, field) record —
 *  the descriptor buckets by the term keys and reuses the counts as the
 *  field's BM25 `termCounts` directly (structurally its `FieldStats`). */
type FieldTerms = {
    termCounts: Map<string, number>
    length: number
    positions?: Map<string, number[]>
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

/** Per-call query options. `offset` / `limit` window the ranked results
 *  (overriding the instance-level `limit`); `weights` overrides per-field
 *  boosts for THIS query (one index can then serve different ranking needs —
 *  e.g. weight `title` heavily for one search, `body` for another). Fields
 *  absent from `weights` keep their construction boost. `filter` restricts
 *  results to documents whose `facets` assignment matches (AND across facet
 *  fields, OR within a field's listed values) — requires the `facets` option.
 *  Omit all for the default view. */
export type SearchPage = {
    offset?: number
    limit?: number
    weights?: Record<string, number>
    filter?: Record<string, string | string[]>
}

/** A snapshot of index statistics (per store), resolved reactively. */
export type SearchStats = {
    /** Distinct documents (atoms) currently indexed in this store. */
    documentCount: number
    /** Per-field document count and average length (in words). */
    fields: Record<string, { documentCount: number; averageLength: number }>
}

export type AtomFamilySearch<Value, Args extends [any, ...any[]]> = {
    /** Returns a selector resolving to matching atoms, in ranking order
     *  for `match: "ranked"` strategies. Pass `{ offset, limit }` to
     *  paginate a single query without re-scoring (the full ranking is
     *  computed once and sliced). */
    (query: string, page?: SearchPage): Selector<AtomFamilyAtom<Value, Args>[]>
    /** Returns a selector resolving to `{ atom, score }` pairs in ranking
     *  order. Score is the BM25F relevance (× coordination factor).
     *  Accepts the same `{ offset, limit }` pagination window. */
    scored(
        query: string,
        page?: SearchPage,
    ): Selector<ScoredResult<Value, Args>[]>
    /** Term completions for an autocomplete `prefix`, ranked by document
     *  frequency (most common first). Reads the instance vocabulary, so it
     *  returns results in `prefix` mode or when `tolerance > 0` (the modes
     *  that track a whole-word vocabulary), otherwise `[]`. Synchronous and
     *  store-independent — fine to call on every keystroke. */
    suggest(prefix: string, limit?: number): string[]
    /** Character ranges in `text` that match `query`, for highlighting a
     *  result. Binds this instance's tokenizer config (stem / stop words /
     *  prefix-vs-exact) to `highlightMatches`, so highlights line up with
     *  what actually matched. */
    highlight(
        query: string,
        text: string,
        options?: { merge?: boolean },
    ): HighlightRange[]
    /** Reactive index statistics for the reading store. */
    stats: Selector<SearchStats>
    /** Reactive facet counts over the documents matching `query` — for each
     *  facet field, how many matches carry each value: `{ category: { books:
     *  3, film: 1 } }`. Pass `fields` to count only some facets (default: all
     *  fields the `facets` option yields). Counts are over the full match set
     *  (before any `limit`) and ignore `filter`, so a UI can show available
     *  drill-downs. Requires the `facets` option; otherwise resolves to `{}`. */
    facets(
        query: string,
        fields?: string[],
    ): Selector<Record<string, Record<string, number>>>
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
    // exact AND prefix both index whole words. Prefix MATCHING happens at
    // query time: the query token resolves to every indexed word it prefixes
    // via the vocabulary scan (Lucene-style prefix → OR of term queries).
    // Indexing whole words keeps a prefix index the same size as an exact
    // index — no per-word-length explosion — and lets each matched word
    // carry its own df / TF into BM25 ranking. Only trigram expands on write.
    if (mode === "exact" || mode === "prefix") return tokens
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
 *  - AND or ranked-OR combining; ranking is BM25F (field-weighted).
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
// Overload: single-string extractor — no field-name inference needed,
// `fields` keys (if passed) accept any string. Returning `null`,
// `undefined`, or `""` skips indexing for that atom.
export function atomFamilySearch<
    Value,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    family: AtomFamily<Value, Args>,
    extractor: (value: Value) => string | null | undefined,
    options?: AtomFamilySearchOptions<string, Value>,
): AtomFamilySearch<Value, Args>

// Overload: field-map extractor — `Fields` infers from the extractor's
// return shape, so `options.fields` keys are type-checked. Per-field
// values of `null`/`undefined`/`""` are skipped; returning `null` or
// `undefined` for the whole record skips the atom entirely.
export function atomFamilySearch<
    Value,
    Args extends [any, ...any[]],
    Fields extends string,
>(
    family: AtomFamily<Value, Args>,
    extractor: (
        value: Value,
    ) => Record<Fields, string | null | undefined> | null | undefined,
    options?: AtomFamilySearchOptions<Fields, Value>,
): AtomFamilySearch<Value, Args>

export function atomFamilySearch<
    Value extends any,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    family: AtomFamily<Value, Args>,
    extractor: (
        value: Value,
    ) =>
        | string
        | Record<string, string | null | undefined>
        | null
        | undefined,
    options?: AtomFamilySearchOptions<string>,
): AtomFamilySearch<Value, Args> {
    const mode: SearchMode = options?.mode ?? "exact"
    const matchStrategy: MatchStrategy =
        options?.match ?? (mode === "exact" ? "all" : "ranked")
    // Language preset fills in defaults for tokenize / stem / stopWords;
    // explicit options always win. `stopWords: true` still resolves to
    // englishStopWords via `resolveStopWords` regardless of preset.
    // The preset can be either a built-in name (`"english"`) or a
    // LanguagePreset object imported from `@valdres/search-languages`.
    const preset: LanguagePreset | undefined =
        typeof options?.language === "string"
            ? LANGUAGE_PRESETS[options.language]
            : options?.language
    const baseTokenize =
        options?.tokenize ?? preset?.tokenize ?? defaultTokenize
    const stem = options?.stem ?? preset?.stem
    const stopWords =
        options?.stopWords !== undefined
            ? resolveStopWords(options.stopWords)
            : (preset?.stopWords ?? null)
    const bm25Params: BM25Params = {
        k1: options?.bm25?.k1 ?? DEFAULT_BM25.k1,
        b: options?.bm25?.b ?? DEFAULT_BM25.b,
        d: options?.bm25?.d ?? DEFAULT_BM25.d,
    }
    const fieldBoost = (field: string): number =>
        options?.fields?.[field]?.boost ?? 1

    // ── Facets / filtering (#12) ─────────────────────────────────────────
    // The facet extractor maps a document to its categorical values. It is
    // read reactively at QUERY time (per candidate / result atom), so filter
    // and facet counts stay scope-correct and update when a doc's facet
    // value changes — no separate index to keep in sync.
    const facetsExtractor = options?.facets

    type ParsedFilter = { field: string; values: Set<string> }[]
    /** Normalize a SearchPage `filter` into field → allowed-value-set.
     *  Empty fields are dropped. */
    const parseFilter = (
        filter: Record<string, string | string[]> | undefined,
    ): ParsedFilter => {
        const out: ParsedFilter = []
        if (!filter) return out
        for (const field in filter) {
            const raw = filter[field]
            const values = new Set(
                (Array.isArray(raw) ? raw : [raw])
                    .filter(v => v != null)
                    .map(String),
            )
            if (values.size > 0) out.push({ field, values })
        }
        return out
    }
    /** A document's value passes the filter when, for EVERY filtered field,
     *  at least one of the doc's facet values for that field is allowed
     *  (AND across fields, OR within a field). */
    const docPassesFilter = (value: Value, parsed: ParsedFilter): boolean => {
        if (!facetsExtractor) return false
        const raw = facetsExtractor(value)
        if (!raw) return false
        for (const { field, values } of parsed) {
            const dv = raw[field]
            if (dv == null) return false
            const docVals = Array.isArray(dv) ? dv : [dv]
            let hit = false
            for (const x of docVals)
                if (x != null && values.has(String(x))) {
                    hit = true
                    break
                }
            if (!hit) return false
        }
        return true
    }
    /** Stable cache-key fragment for a filter. Fields and values sorted so
     *  logically-equal filters share a cache slot. */
    const filterKey = (
        filter: Record<string, string | string[]> | undefined,
    ): string => {
        const parsed = parseFilter(filter)
        if (parsed.length === 0) return ""
        return parsed
            .map(p => `${p.field}=${[...p.values].sort().join("|")}`)
            .sort()
            .join(",")
    }

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

    /** Normalize the extractor's return value into `Map<field, FieldTerms>`.
     *  Single-string returns get the `DEFAULT_FIELD` name; object returns keep
     *  their keys; empty/missing field values are dropped. Called once per
     *  write by the single search descriptor (no memo needed — the old
     *  two-descriptor design memoized to run the user extractor once across
     *  both passes; with one descriptor it's naturally once). */
    // Build the per-field entry: `terms` is the matched-against, mode-
    // expanded vocabulary (prefixes / trigrams / whole tokens); `length`
    // is the BM25 document length and is ALWAYS the raw word count, never
    // the expanded count. In prefix/trigram mode the expansion size scales
    // with word length, so using it as `length` would penalize docs that
    // contain longer words ("Stranger" → 8 prefixes vs "City" → 4) purely
    // for word length — distorting length normalization. Orama (and
    // standard BM25) normalize by word count; we match that.
    const fieldEntry = (text: string): FieldTerms | null => {
        const tokens = normalize(text)
        if (tokens.length === 0) return null
        const terms = expandForWrite(tokens, mode)
        if (terms.length === 0) return null
        // Count occurrences once, here — both descriptors consume this map
        // (token index → keys, BM25 → the counts) so neither re-walks terms.
        const termCounts = new Map<string, number>()
        for (const t of terms) termCounts.set(t, (termCounts.get(t) ?? 0) + 1)
        let positions: Map<string, number[]> | undefined
        if (positionsEnabled) {
            // Positions are word indices in the normalized stream — the same
            // space phrase queries normalize into, so adjacency lines up
            // across stopword removal and stemming.
            positions = new Map()
            for (let i = 0; i < tokens.length; i++) {
                const arr = positions.get(tokens[i])
                if (arr) arr.push(i)
                else positions.set(tokens[i], [i])
            }
        }
        return { termCounts, length: tokens.length, positions }
    }
    const extractFieldTerms = (value: Value): Map<string, FieldTerms> => {
        const raw = extractor(value)
        const out = new Map<string, FieldTerms>()
        if (typeof raw === "string") {
            if (raw.length > 0) {
                const e = fieldEntry(raw)
                if (e) out.set(DEFAULT_FIELD, e)
            }
        } else if (raw && typeof raw === "object") {
            for (const field in raw) {
                const text = raw[field]
                if (typeof text !== "string" || text.length === 0) continue
                const e = fieldEntry(text)
                if (e) out.set(field, e)
            }
        }
        return out
    }

    // The unified search index (buckets + reactive term atoms + BM25 stats
    // in one pass) is created below, after the vocab/bkTree declarations it
    // wires its hooks to — see `createSearchDescriptor`.

    type TokenSetEntry = {
        array: AtomFamilyAtom<Value, Args>[]
        set: Set<AtomFamilyAtom<Value, Args>>
    }
    const tokenSetCache = new Map<string, TokenSetEntry>()

    const getTokenSet = (
        token: string,
        get: <V>(state: Atom<V>) => V,
    ): Set<AtomFamilyAtom<Value, Args>> => {
        // The descriptor stores heterogeneous `AtomFamilyAtom<any>`; narrow
        // back to this family's atom type (same object at runtime).
        const arr = get(
            sd.termAtom(token) as unknown as Atom<
                AtomFamilyAtom<Value, Args>[]
            >,
        )
        const cached = tokenSetCache.get(token)
        if (cached && cached.array === arr) return cached.set
        const set = new Set(arr)
        tokenSetCache.set(token, { array: arr, set })
        return set
    }

    // Per-query selector caches, keyed by query string. Bounded by an LRU
    // (default 500, configurable via `queryCacheSize`) so a search-as-you-
    // type UI — one distinct query per keystroke — doesn't grow them without
    // limit. `releaseQuery(q)` / `releaseAllQueries()` still drop entries
    // explicitly; eviction or release just means the next read re-allocates.
    const queryCacheSize = options?.queryCacheSize ?? 500
    // Three LRU caches with an explicit dependency chain:
    //   atomsCache → scoredCache → fullScoredCache
    // Each evicts independently; a missing entry is recomputed from the one
    // below it on next access (getAtoms → getScored → getFullScored).
    // Full ranking per query (the expensive part), keyed by query string.
    const fullScoredCache = createLRU<
        string,
        Selector<ScoredResult<Value, Args>[]>
    >(queryCacheSize)
    // Sliced views, keyed by query + pagination window — cheap wrappers over
    // the full ranking, so paginating a query never re-scores.
    const scoredCache = createLRU<
        string,
        Selector<ScoredResult<Value, Args>[]>
    >(queryCacheSize)
    const atomsCache = createLRU<
        string,
        Selector<AtomFamilyAtom<Value, Args>[]>
    >(queryCacheSize)
    // Facet-count selectors, keyed by query + requested-fields (#12). Reclaimed
    // by releaseQuery on the bare-query prefix like the other caches.
    const facetsCache = createLRU<
        string,
        Selector<Record<string, Record<string, number>>>
    >(queryCacheSize)

    const expandSingleToken = (token: string): ExpandedTerm[] => {
        if (mode === "trigram") {
            // Trigrams aren't edit-distance matches; treat each as an
            // exact lookup with penalty 1.0.
            const tris = trigramsOf(token)
            const out = new Array<ExpandedTerm>(tris.length)
            for (let i = 0; i < tris.length; i++) {
                out[i] = { term: tris[i], penalty: 1 }
            }
            return out
        }
        if (mode === "prefix") return expandPrefixMatches(token)
        // exact: optionally expand to tolerance-neighbors
        return expandToleranceMatches(token)
    }

    const minMatchFraction = Math.max(0, Math.min(1, options?.minMatch ?? 0))
    const coordination = Math.max(0, Math.min(1, options?.coordination ?? 0.5))
    const resultLimit =
        options?.limit !== undefined && options.limit > 0
            ? Math.floor(options.limit)
            : Infinity
    // Tolerance only applies in exact / prefix modes — trigram mode is
    // already fuzzy. `Math.max(0, ...)` lets users pass `undefined` or
    // `0` interchangeably for "off".
    const tolerance =
        mode === "trigram"
            ? 0
            : Math.max(0, Math.floor(options?.tolerance ?? 0))

    // The whole-word vocabulary (`termDictionary` + its derived sorted view)
    // is maintained when prefix mode needs it for the prefix scan, or when
    // `tolerance` needs it for fuzzy expansion. Trigram mode never needs it
    // (it matches via n-gram overlap, not whole words).
    const trackVocabulary = mode === "prefix" || tolerance > 0

    // Positional index for phrase queries. Whole-word only — trigram mode
    // has no whole words to position, so the flag is a no-op there.
    const positionsEnabled =
        options?.positions === true &&
        (mode === "exact" || mode === "prefix")

    /** Bumped whenever a DISTINCT word enters or leaves the vocabulary
     *  (a 0↔1 membership edge, signalled by the descriptor's vocab hooks).
     *  The prefix scan caches a sorted view keyed on this version, so it
     *  rebuilds only when membership actually changes. */
    let vocabVersion = 0
    let sortedVocabCache: { version: number; words: string[] } | null = null

    /** BK-tree over the vocabulary for sublinear fuzzy lookup. Only built
     *  when `tolerance > 0` (prefix-only instances never fuzz). Maintained on
     *  the same 0↔1 membership edges as the sorted-prefix cache. */
    const bkTree: BKTree | null =
        tolerance > 0 ? createBKTree(levenshtein) : null

    /** The unified search index (#6): ONE descriptor maintaining inverted
     *  buckets + reactive term atoms (the query candidate/subscription
     *  surface) AND per-(atom, field) BM25 stats + fieldTotals, in a single
     *  write pass over a single per-atom record. The vocabulary structures
     *  above are driven by its distinct-term edge hooks; the descriptor owns
     *  the occurrence refcounts (`termRefs`). */
    const sd = createSearchDescriptor<Value>(extractFieldTerms, {
        name: options?.name,
        vocab: trackVocabulary
            ? {
                  onTermAdded: term => {
                      vocabVersion++
                      bkTree?.add(term)
                  },
                  onTermRemoved: term => {
                      vocabVersion++
                      bkTree?.remove(term)
                  },
              }
            : undefined,
    })
    if (!family.__valdresIndexes) family.__valdresIndexes = new Set()
    family.__valdresIndexes.add(sd.descriptor)

    /** Occurrence-refcounted vocabulary, owned by the descriptor — keys are
     *  the vocabulary (for the prefix scan / suggest), values the frequency
     *  (suggest ranking). Empty unless a vocabulary is tracked. */
    const termDictionary = sd.termRefs

    type SearchStorageRef = Parameters<typeof sd.getFieldStats>[0]

    /** True if `phraseTokens` appear at consecutive, in-order positions within
     *  a single field of `atom` (an exact phrase match), via the positional
     *  index. */
    const atomMatchesPhrase = (
        atom: AtomFamilyAtom<Value, Args>,
        phraseTokens: string[],
        storage: SearchStorageRef,
    ): boolean => {
        const fields = sd.getFieldStats(
            storage,
            atom as unknown as AtomFamilyAtom<any>,
        )
        if (!fields) return false
        for (const fs of fields.values()) {
            const positions = fs.positions
            if (!positions) continue
            const starts = positions.get(phraseTokens[0])
            if (!starts) continue
            for (const start of starts) {
                let ok = true
                for (let k = 1; k < phraseTokens.length; k++) {
                    const at = positions.get(phraseTokens[k])
                    if (!at || at.indexOf(start + k) === -1) {
                        ok = false
                        break
                    }
                }
                if (ok) return true
            }
        }
        return false
    }

    /** Sorted snapshot of the vocabulary for binary-search prefix lookups,
     *  rebuilt lazily when membership changes. Prefix matches form a
     *  contiguous run in sorted order, so we binary-search the lower bound
     *  then walk while the prefix holds: O(V log V) to (re)sort on a
     *  vocabulary change, O(log V + matches) per lookup otherwise — in line
     *  with the "modest corpus" contract `tolerance` already documents. A
     *  trie would make maintenance incremental (no resort); revisit if it
     *  bites. */
    const getSortedVocab = (): string[] => {
        if (sortedVocabCache && sortedVocabCache.version === vocabVersion) {
            return sortedVocabCache.words
        }
        const words = [...termDictionary.keys()]
        words.sort()
        sortedVocabCache = { version: vocabVersion, words }
        return words
    }
    const vocabWordsWithPrefix = (prefix: string): string[] => {
        const words = getSortedVocab()
        let lo = 0
        let hi = words.length
        while (lo < hi) {
            const mid = (lo + hi) >>> 1
            if (words[mid] < prefix) lo = mid + 1
            else hi = mid
        }
        const out: string[] = []
        for (
            let i = lo;
            i < words.length && words[i].startsWith(prefix);
            i++
        ) {
            out.push(words[i])
        }
        return out
    }

    /** One indexed term + a relevance multiplier (1.0 for exact match,
     *  < 1 for typo'd matches). Plain BM25F values rare terms — without
     *  a penalty, a one-doc typo'd match with df=1 can outrank a much
     *  larger pool of exact matches because of the IDF bonus. The
     *  penalty restores intuitive "exact matches win" ranking.
     *
     *  Penalty curve: `1 / (1 + distance)`. Distance 0 → 1.0;
     *  distance 1 → 0.5; distance 2 → 0.33. Matches MiniSearch's
     *  approach of weighting fuzzy matches below exact (their
     *  `weights.fuzzy` default is 0.45). */
    type ExpandedTerm = { term: string; penalty: number }

    /** True when a query token is long enough to fuzz. Edit-distance-
     *  `tolerance` on a very short token matches an enormous neighborhood
     *  (a 3-char "str" at distance 1 reaches "sto", "sta", "ste"…), so it
     *  drowns the genuine match and the fuzzed term carries near-zero IDF.
     *  Require length > `tolerance + 2`; shorter tokens match exactly / by
     *  prefix only. A real typo lives in a longer word ("strangr"), which
     *  clears the bar and still corrects. */
    const clearsFuzzGuard = (token: string): boolean =>
        tolerance > 0 && token.length > tolerance + 2

    /** Indexed words within `tolerance` edits of `token`, each tagged with a
     *  distance-based penalty. Excludes `token` itself; the caller decides
     *  whether the token clears the length guard. Resolved via the BK-tree
     *  (sublinear, triangle-inequality pruning) rather than a linear walk of
     *  the whole vocabulary. */
    const fuzzyMatches = (token: string): ExpandedTerm[] => {
        if (!bkTree) return []
        const hits = bkTree.search(token, tolerance)
        const matches: ExpandedTerm[] = new Array(hits.length)
        for (let i = 0; i < hits.length; i++) {
            matches[i] = {
                term: hits[i].word,
                penalty: 1 / (1 + hits[i].distance),
            }
        }
        return matches
    }

    /** exact-mode token expansion: the token itself (penalty 1, always — so
     *  an exact match hits even for an unindexed token) plus, when it clears
     *  the length guard, fuzzy neighbors. */
    const expandToleranceMatches = (token: string): ExpandedTerm[] => {
        if (!clearsFuzzGuard(token)) return [{ term: token, penalty: 1 }]
        return [{ term: token, penalty: 1 }, ...fuzzyMatches(token)]
    }

    /** prefix-mode token expansion: every indexed word the token prefixes
     *  (penalty 1 — a true prefix hit), plus, when `tolerance > 0` and the
     *  token clears the length guard, fuzzy whole-word matches (penalty < 1)
     *  so typo'd partials still correct. A prefix hit always wins the dedup
     *  over a fuzzy hit for the same word. */
    const expandPrefixMatches = (token: string): ExpandedTerm[] => {
        const out: ExpandedTerm[] = []
        const seen = new Set<string>()
        for (const word of vocabWordsWithPrefix(token)) {
            if (seen.has(word)) continue
            seen.add(word)
            out.push({ term: word, penalty: 1 })
        }
        if (clearsFuzzGuard(token)) {
            for (const m of fuzzyMatches(token)) {
                if (seen.has(m.term)) continue
                seen.add(m.term)
                out.push(m)
            }
        }
        return out
    }

    const computeScored = (
        query: string,
        weights?: Record<string, number>,
        filter?: Record<string, string | string[]>,
    ) => {
        // Per-query effective field boost: weights override construction
        // boosts for this query (#13); absent fields keep their boost.
        const boostOf = (field: string): number =>
            weights?.[field] ?? fieldBoost(field)
        // Parse the facet filter (#12) once per query; applied as a per-
        // candidate predicate inside the selector (reads each candidate's
        // value, so it stays reactive + scope-correct).
        const parsedFilter = parseFilter(filter)
        const hasFilter = parsedFilter.length > 0
        const queryTokens = normalize(query)
        // Denominator for the coordination factor: distinct normalized
        // query terms. A doc that matched all of them gets full score; one
        // matching a subset is scaled down toward `1 - coordination`.
        const distinctQueryTerms = new Set(queryTokens).size
        // Double-quoted runs are phrase (adjacency) constraints, applied as a
        // hard filter on candidates. Only with the positional index — the
        // tokenizer strips quotes otherwise, so the words just flow through
        // `queryTokens` and contribute to the base score / coverage as usual.
        // A single-word quote imposes no adjacency, so it's left as a term.
        const phrases: string[][] = []
        if (positionsEnabled) {
            const re = /"([^"]+)"/g
            let m: RegExpExecArray | null
            while ((m = re.exec(query)) !== null) {
                const toks = normalize(m[1])
                if (toks.length >= 2) phrases.push(toks)
            }
        }
        const queryName = options?.name
            ? `${options.name}:scored:${query}`
            : undefined

        return selector<ScoredResult<Value, Args>[]>(
            get => {
                if (queryTokens.length === 0) return []
                const typedGet = get as <V>(s: Atom<V>) => V
                const N = Math.max(family.__valdresAtomFamilyMap.size, 1)

                // Subscribe to stats updates and grab the current (mutable)
                // storage object. Stats are read freshly in the loop below.
                const bm25Storage = typedGet(sd.statsAtom)

                // Per-query-token aggregation. The BM25F contribution per
                // (atom, field, term) is summed into `scores`. The
                // `matched` map records which user-typed query tokens
                // contributed to each atom's score — used for the
                // highlighting metadata in `scored()` results.
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

                // `avgdl` is per-field and stable for the whole query — cache
                // it so we don't walk the scope chain once per (atom, field).
                // `-1` marks a field with no documents (skip it).
                const avgdlCache = new Map<string, number>()
                const avgdlFor = (field: string): number => {
                    const cached = avgdlCache.get(field)
                    if (cached !== undefined) return cached
                    const tot = sd.getFieldTotal(bm25Storage, field)
                    const a =
                        tot.docCount > 0 ? tot.totalLength / tot.docCount : -1
                    avgdlCache.set(field, a)
                    return a
                }

                for (const queryToken of queryTokens) {
                    const terms = expandSingleToken(queryToken)
                    totalQueryTerms += terms.length
                    const tokenMatched = new Set<AtomFamilyAtom<Value, Args>>()
                    for (const { term, penalty } of terms) {
                        const bucket = getTokenSet(term, typedGet)
                        if (bucket.size === 0) continue
                        const df = bucket.size
                        // `idf` depends only on (df, N) — compute once per term
                        // instead of once per matching document.
                        const idf = bm25Idf(df, N)
                        for (const atom of bucket) {
                            // Sum BM25F contributions across the atom's
                            // fields. Walk the parent chain: closest
                            // scope's stats win (scope shadowing).
                            const atomFields = sd.getFieldStats(
                                bm25Storage,
                                atom as unknown as AtomFamilyAtom<any>,
                            )
                            if (!atomFields) continue
                            let termScore = 0
                            for (const [field, fs] of atomFields) {
                                const tf = fs.termCounts.get(term) ?? 0
                                if (tf === 0) continue
                                const avgdl = avgdlFor(field)
                                if (avgdl < 0) continue
                                // `penalty` < 1 for typo'd matches —
                                // restores intuitive "exact > fuzzy"
                                // ranking. Always 1 for non-tolerance.
                                termScore +=
                                    penalty *
                                    boostOf(field) *
                                    bm25ScoreWithIdf(
                                        idf,
                                        tf,
                                        fs.length,
                                        avgdl,
                                        bm25Params,
                                    )
                            }
                            if (termScore <= 0) continue
                            scores.set(
                                atom,
                                (scores.get(atom) ?? 0) + termScore,
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
                    // Facet filter (#12): drop candidates whose facet values
                    // don't satisfy the filter. Reads the doc value via
                    // `typedGet` so the result stays reactive to facet edits
                    // and resolves in the reading store's scope. Checked
                    // before scoring so filtered-out docs cost nothing more.
                    if (hasFilter) {
                        const value = typedGet(
                            atom as unknown as Atom<Value>,
                        )
                        if (!docPassesFilter(value, parsedFilter)) continue
                    }
                    // Phrase constraint: every quoted phrase must appear as an
                    // adjacent, in-order run in some field. A hard filter —
                    // quotes mean "this exact phrase", regardless of match
                    // strategy.
                    if (phrases.length > 0) {
                        let ok = true
                        for (const phrase of phrases) {
                            if (
                                !atomMatchesPhrase(atom, phrase, bm25Storage)
                            ) {
                                ok = false
                                break
                            }
                        }
                        if (!ok) continue
                    }
                    if (minMatchCount > 0) {
                        const c = termMatchCount.get(atom) ?? 0
                        if (c < minMatchCount) continue
                    }
                    const matchedTerms = matched.get(atom)
                    // Coordination: scale the summed BM25F score by how many
                    // distinct query terms this doc covered. Skipped when
                    // off (coordination 0) or trivially full coverage, so
                    // single-term / match:"all" queries pay nothing and are
                    // unchanged.
                    let score = scores.get(atom) ?? 0
                    if (coordination > 0 && distinctQueryTerms > 0) {
                        const coverage =
                            (matchedTerms?.size ?? 0) / distinctQueryTerms
                        score *= 1 - coordination + coordination * coverage
                    }
                    entries.push({
                        atom,
                        score,
                        matched: [...(matchedTerms ?? [])],
                    })
                }
                if (entries.length === 0) return entries
                entries.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score
                    const sa = String(a.atom.familyArgsStringified)
                    const sb = String(b.atom.familyArgsStringified)
                    return sa < sb ? -1 : sa > sb ? 1 : 0
                })
                // Full ranking — the `limit` / `offset` window is applied by
                // the view wrappers (`getScored` / `getAtoms`) so a query can
                // be paginated without re-scoring.
                return entries
            },
            queryName ? { name: queryName } : undefined,
        )
    }

    // ── WAND top-K path (#9) ─────────────────────────────────────────────
    // For ranked, `limit`-bounded queries, skip scoring documents that can't
    // enter the top-K (per-term max-impact pivoting). Eligible only where it
    // can reproduce the naive ranking exactly: ranked match, no minMatch,
    // finite limit, exact/prefix mode, root store (runtime), no phrases. Any
    // ineligible case falls back to the naive full ranking, sliced. Verified
    // identical to naive by the differential fuzzer (force `__wand: false`).
    const wandEnabled =
        (options as { __wand?: boolean } | undefined)?.__wand !== false
    const wandEligibleStatic =
        wandEnabled &&
        matchStrategy === "ranked" &&
        minMatchFraction === 0 &&
        Number.isFinite(resultLimit) &&
        (mode === "exact" || mode === "prefix")
    const kBd = bm25Params.k1 + 1 + bm25Params.d

    const computeTopK = (
        query: string,
        weights?: Record<string, number>,
    ) => {
        const boostOf = (field: string): number =>
            weights?.[field] ?? fieldBoost(field)
        const queryTokens = normalize(query)
        const distinctQueryTerms = new Set(queryTokens).size
        let hasPhrase = false
        if (positionsEnabled) {
            const re = /"([^"]+)"/g
            let m: RegExpExecArray | null
            while ((m = re.exec(query)) !== null) {
                if (normalize(m[1]).length >= 2) {
                    hasPhrase = true
                    break
                }
            }
        }
        const queryName = options?.name
            ? `${options.name}:topk:${query}`
            : undefined
        return selector<ScoredResult<Value, Args>[]>(
            get => {
                if (queryTokens.length === 0) return []
                const typedGet = get as <V>(s: Atom<V>) => V
                const storage = typedGet(sd.statsAtom)
                // Runtime-ineligible (scoped store / phrase) → naive, sliced.
                if (hasPhrase || storage.parent !== undefined) {
                    const full = typedGet(
                        getFullScored(query, weights) as unknown as Atom<
                            ScoredResult<Value, Args>[]
                        >,
                    )
                    return Number.isFinite(resultLimit) &&
                        full.length > resultLimit
                        ? full.slice(0, resultLimit)
                        : full
                }
                const N = Math.max(family.__valdresAtomFamilyMap.size, 1)
                const avgdlCache = new Map<string, number>()
                const avgdlFor = (field: string): number => {
                    const c = avgdlCache.get(field)
                    if (c !== undefined) return c
                    const tot = sd.getFieldTotal(storage, field)
                    const a =
                        tot.docCount > 0 ? tot.totalLength / tot.docCount : -1
                    avgdlCache.set(field, a)
                    return a
                }
                let sumFieldBoost = 0
                for (const f of sd.collectFieldNames(storage))
                    sumFieldBoost += boostOf(f)
                if (sumFieldBoost === 0) sumFieldBoost = 1

                // Expand each query token → its indexed terms (+ bucket, idf,
                // penalty), exactly as the naive path does.
                type Exp = {
                    term: string
                    penalty: number
                    idf: number
                    bucket: Set<AtomFamilyAtom<Value, Args>>
                }
                const perToken: Exp[][] = []
                for (const qt of queryTokens) {
                    const exps: Exp[] = []
                    for (const { term, penalty } of expandSingleToken(qt)) {
                        const bucket = getTokenSet(term, typedGet)
                        if (bucket.size === 0) continue
                        exps.push({
                            term,
                            penalty,
                            idf: bm25Idf(bucket.size, N),
                            bucket,
                        })
                    }
                    perToken.push(exps)
                }

                // Per-atom score — MUST mirror computeScored's accumulation so
                // WAND's output is identical to the naive ranking.
                const scoreAtom = (
                    atom: AtomFamilyAtom<Value, Args>,
                ): { score: number; matched: string[] } => {
                    const fields = sd.getFieldStats(
                        storage,
                        atom as unknown as AtomFamilyAtom<any>,
                    )
                    if (!fields) return { score: 0, matched: [] }
                    let score = 0
                    const matched: string[] = []
                    for (let t = 0; t < queryTokens.length; t++) {
                        let hit = false
                        for (const { term, penalty, idf } of perToken[t]) {
                            let termScore = 0
                            for (const [field, fs] of fields) {
                                const tf = fs.termCounts.get(term) ?? 0
                                if (tf === 0) continue
                                const avgdl = avgdlFor(field)
                                if (avgdl < 0) continue
                                termScore +=
                                    penalty *
                                    boostOf(field) *
                                    bm25ScoreWithIdf(
                                        idf,
                                        tf,
                                        fs.length,
                                        avgdl,
                                        bm25Params,
                                    )
                            }
                            if (termScore > 0) {
                                score += termScore
                                hit = true
                            }
                        }
                        if (hit) matched.push(queryTokens[t])
                    }
                    if (score > 0 && coordination > 0 && distinctQueryTerms > 0) {
                        const coverage =
                            new Set(matched).size / distinctQueryTerms
                        score *= 1 - coordination + coordination * coverage
                    }
                    return { score, matched }
                }

                // Build cursors (one per (token, term)) + ordinal→atom map.
                const localMap = new Map<number, AtomFamilyAtom<Value, Args>>()
                const cursors: WandTerm[] = []
                for (const exps of perToken) {
                    for (const { penalty, idf, bucket } of exps) {
                        const ords = new Int32Array(bucket.size)
                        let i = 0
                        for (const a of bucket) {
                            const o = sd.ordinalOf(
                                a as unknown as AtomFamilyAtom<any>,
                            )
                            ords[i++] = o
                            if (!localMap.has(o)) localMap.set(o, a)
                        }
                        ords.sort()
                        cursors.push({
                            postings: ords,
                            maxImpact: penalty * sumFieldBoost * idf * kBd,
                        })
                    }
                }
                if (cursors.length === 0) return []
                const cache = new Map<
                    number,
                    { score: number; matched: string[] }
                >()
                const evalOrd = (o: number) => {
                    let r = cache.get(o)
                    if (!r) {
                        r = scoreAtom(
                            localMap.get(o) as AtomFamilyAtom<Value, Args>,
                        )
                        cache.set(o, r)
                    }
                    return r
                }
                const hits = wandTopK(
                    cursors,
                    resultLimit,
                    o => {
                        const s = evalOrd(o).score
                        return s > 0 ? s : null
                    },
                    (a, b) => {
                        const sa = String(
                            (localMap.get(a) as AtomFamilyAtom<Value, Args>)
                                .familyArgsStringified,
                        )
                        const sb = String(
                            (localMap.get(b) as AtomFamilyAtom<Value, Args>)
                                .familyArgsStringified,
                        )
                        return sa < sb ? -1 : sa > sb ? 1 : 0
                    },
                )
                const out = new Array<ScoredResult<Value, Args>>(hits.length)
                for (let i = 0; i < hits.length; i++) {
                    const atom = localMap.get(
                        hits[i].ordinal,
                    ) as AtomFamilyAtom<Value, Args>
                    out[i] = {
                        atom,
                        score: hits[i].score,
                        matched: [...new Set(evalOrd(hits[i].ordinal).matched)],
                    }
                }
                return out
            },
            queryName ? { name: queryName } : undefined,
        )
    }

    // Stable key fragment for a query-time weight override. Empty/absent →
    // "" (the unweighted default keys on the bare query). Keys are sorted so
    // `{title:3, body:1}` and `{body:1, title:3}` collapse to one cache slot.
    const weightKey = (weights?: Record<string, number>): string => {
        if (!weights) return ""
        const keys = Object.keys(weights).sort()
        if (keys.length === 0) return ""
        return keys.map(k => `${k}=${weights[k]}`).join(",")
    }

    const getFullScored = (
        query: string,
        weights?: Record<string, number>,
        filter?: Record<string, string | string[]>,
    ) => {
        const wk = weightKey(weights)
        const fk = filterKey(filter)
        // Weighted / filtered views append after a NUL so
        // releaseQuery(query) still reclaims them (its match prefix is
        // the bare query + NUL).
        const cacheKey =
            wk || fk ? `${query}\u0000w\u0000${wk}\u0000f\u0000${fk}` : query
        const cached = fullScoredCache.get(cacheKey)
        if (cached) return cached
        const sel = computeScored(query, weights, filter)
        fullScoredCache.set(cacheKey, sel)
        return sel
    }

    /** Resolve a pagination window: `offset` defaults to 0, `limit` to the
     *  instance-level `limit` (Infinity if unset). */
    const resolvePage = (
        page?: SearchPage,
    ): { offset: number; limit: number } => {
        const rawOffset = page?.offset
        // Guard NaN explicitly — `Math.max(0, Math.floor(NaN))` is NaN, which
        // would slice to an empty page. Non-finite / negative → 0.
        const offset =
            typeof rawOffset === "number" && Number.isFinite(rawOffset)
                ? Math.max(0, Math.floor(rawOffset))
                : 0
        const rawLimit = page?.limit
        const limit =
            typeof rawLimit === "number" &&
            Number.isFinite(rawLimit) &&
            rawLimit > 0
                ? Math.floor(rawLimit)
                : resultLimit
        return { offset, limit }
    }
    const pageKey = (query: string, page?: SearchPage): string => {
        const { offset, limit } = resolvePage(page)
        const wk = weightKey(page?.weights)
        const fk = filterKey(page?.filter)
        // Unwindowed, unweighted, unfiltered view keys on the bare query
        // (stable identity; matched by releaseQuery). Windowed / weighted /
        // filtered views append after a NUL — a separator real queries don't
        // contain — so releaseQuery("foo") cannot accidentally match "foo bar".
        if (offset === 0 && !Number.isFinite(limit) && !wk && !fk)
            return query
        const lim = Number.isFinite(limit) ? String(limit) : "inf"
        const base = `${query}\u0000${offset}\u0000${lim}`
        return wk || fk ? `${base}\u0000w\u0000${wk}\u0000f\u0000${fk}` : base
    }

    const getScored = (query: string, page?: SearchPage) => {
        const key = pageKey(query, page)
        const cached = scoredCache.get(key)
        if (cached) return cached
        const { offset, limit } = resolvePage(page)
        const weights = page?.weights
        const filter = page?.filter
        const hasFilter = parseFilter(filter).length > 0
        let sel: Selector<ScoredResult<Value, Args>[]>
        if (
            offset === 0 &&
            limit === resultLimit &&
            wandEligibleStatic &&
            !hasFilter
        ) {
            // Default ranked + limited view → WAND top-K (it falls back to the
            // naive ranking at eval time when scoped / phrase-constrained).
            // Does NOT build the full ranking, so it stays sublinear. A facet
            // filter routes to the full naive ranking instead — WAND's
            // ordinal-only path can't apply the per-doc filter predicate.
            sel = computeTopK(query, weights)
        } else if (offset === 0 && !Number.isFinite(limit)) {
            // Unbounded view → the full ranking IS the view.
            sel = getFullScored(query, weights, filter)
        } else {
            // Windowed (or non-WAND limited) view → slice the full ranking.
            const full = getFullScored(query, weights, filter)
            sel = selector<ScoredResult<Value, Args>[]>(
                get => {
                    const all = get(full)
                    const end = Number.isFinite(limit) ? offset + limit : all.length
                    if (offset === 0 && end >= all.length) return all
                    return all.slice(offset, end)
                },
                options?.name
                    ? { name: `${options.name}:scored:${key}` }
                    : undefined,
            )
        }
        scoredCache.set(key, sel)
        return sel
    }

    const getAtoms = (query: string, page?: SearchPage) => {
        const key = pageKey(query, page)
        const cached = atomsCache.get(key)
        if (cached) return cached
        const scoredSel = getScored(query, page)
        const sel = selector<AtomFamilyAtom<Value, Args>[]>(
            get => {
                const scored = get(scoredSel)
                const out = new Array<AtomFamilyAtom<Value, Args>>(scored.length)
                for (let i = 0; i < scored.length; i++) out[i] = scored[i].atom
                return out
            },
            options?.name ? { name: `${options.name}:${key}` } : undefined,
        )
        atomsCache.set(key, sel)
        return sel
    }

    const result: AtomFamilySearch<Value, Args> = ((
        query: string,
        page?: SearchPage,
    ) => getAtoms(query, page)) as AtomFamilySearch<Value, Args>
    result.scored = getScored

    result.suggest = (prefix: string, limit = 10): string[] => {
        // Lowercase/split via the configured tokenizer; complete the LAST
        // token. No stemming — the user is typing a partial word. Reads the
        // refcounted vocabulary, so it only yields results when a vocabulary
        // is tracked (prefix mode or tolerance > 0).
        const toks = baseTokenize(prefix)
        if (toks.length === 0) return []
        const words = vocabWordsWithPrefix(toks[toks.length - 1])
        if (words.length === 0) return []
        // Rank by document frequency (most common completion first), then
        // alphabetically for stability.
        words.sort((a, b) => {
            const fb = termDictionary.get(b) ?? 0
            const fa = termDictionary.get(a) ?? 0
            if (fb !== fa) return fb - fa
            return a < b ? -1 : a > b ? 1 : 0
        })
        return limit > 0 && words.length > limit
            ? words.slice(0, limit)
            : words
    }

    result.highlight = (
        query: string,
        text: string,
        opts?: { merge?: boolean },
    ): HighlightRange[] =>
        highlightMatches(text, query, {
            stem,
            stopWords: stopWords ?? undefined,
            mode: mode === "prefix" ? "prefix" : "exact",
            merge: opts?.merge,
        })

    result.stats = selector<SearchStats>(
        get => {
            const storage = (get as <V>(s: Atom<V>) => V)(sd.statsAtom)
            const fields: SearchStats["fields"] = {}
            // Per-field totals, summed across the scope chain (matches scoring).
            for (const field of sd.collectFieldNames(storage)) {
                const tot = sd.getFieldTotal(storage, field)
                if (tot.docCount === 0) continue
                fields[field] = {
                    documentCount: tot.docCount,
                    averageLength: tot.totalLength / tot.docCount,
                }
            }
            return { documentCount: sd.documentCount(storage), fields }
        },
        options?.name ? { name: `${options.name}:stats` } : undefined,
    )

    result.facets = (
        query: string,
        fields?: string[],
    ): Selector<Record<string, Record<string, number>>> => {
        const fieldsKey =
            fields && fields.length > 0 ? [...fields].sort().join("|") : "*"
        // Keyed under the bare-query prefix so releaseQuery reclaims it.
        const key = `${query}\u0000facets\u0000${fieldsKey}`
        const cached = facetsCache.get(key)
        if (cached) return cached
        const want =
            fields && fields.length > 0 ? new Set(fields) : null
        // Count over the FULL match set (unweighted, unfiltered) so the
        // counts reflect every document matching `query`, independent of
        // the page window and of any active filter (available drill-downs).
        const full = getFullScored(query)
        const sel = selector<Record<string, Record<string, number>>>(
            get => {
                const out: Record<string, Record<string, number>> = {}
                if (!facetsExtractor) return out
                const typedGet = get as <V>(s: Atom<V>) => V
                for (const { atom } of get(full)) {
                    const raw = facetsExtractor(
                        typedGet(atom as unknown as Atom<Value>),
                    )
                    if (!raw) continue
                    for (const field in raw) {
                        if (want && !want.has(field)) continue
                        const v = raw[field]
                        const vals = Array.isArray(v) ? v : [v]
                        let bucket = out[field]
                        if (!bucket) out[field] = bucket = {}
                        // Count each value at most once per document — a doc
                        // listing a value twice (e.g. tags ["x", "x"]) is one
                        // document in that value's facet count.
                        const seen = new Set<string>()
                        for (const x of vals) {
                            if (x == null) continue
                            const vk = String(x)
                            if (seen.has(vk)) continue
                            seen.add(vk)
                            bucket[vk] = (bucket[vk] ?? 0) + 1
                        }
                    }
                }
                return out
            },
            options?.name
                ? { name: `${options.name}:facets:${query}\u0000${fieldsKey}` }
                : undefined,
        )
        facetsCache.set(key, sel)
        return sel
    }

    result.releaseQuery = (query: string): boolean => {
        const prefix = `${query}\u0000`
        let had = false
        for (const cache of [
            fullScoredCache,
            scoredCache,
            atomsCache,
            facetsCache,
        ]) {
            for (const k of [...cache.keys()]) {
                if (k === query || k.startsWith(prefix)) {
                    if (cache.delete(k)) had = true
                }
            }
        }
        return had
    }
    result.releaseAllQueries = (): void => {
        fullScoredCache.clear()
        scoredCache.clear()
        atomsCache.clear()
        facetsCache.clear()
    }
    // Test-only backdoor — DELIBERATELY not on the public AtomFamilySearch
    // type, reached only via cast from `atomFamilySearch.test.ts`'s
    // tolerance/termDictionary refcount tests to assert the dictionary
    // shrinks on delete/rewrite (it has no observable effect otherwise).
    // Not part of the public API; do not rely on it.
    ;(result as unknown as { __dictionarySize: () => number }).__dictionarySize =
        () => termDictionary.size
    return result
}
