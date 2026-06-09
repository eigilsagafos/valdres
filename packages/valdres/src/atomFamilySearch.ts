import { atomFamilyIndex } from "./atomFamilyIndex"
import { bm25Score, DEFAULT_BM25, type BM25Params } from "./lib/bm25"
import { equal } from "./lib/equal"
import type {
    IndexDescriptor,
    IndexHookResult,
} from "./lib/IndexDescriptor"
import { levenshtein } from "./lib/levenshtein"
import { setValueInData } from "./lib/setValueInData"
import { trigramsOf } from "./lib/trigramsOf"
import { selector } from "./selector"
import type { Atom } from "./types/Atom"
import type { AtomFamily } from "./types/AtomFamily"
import type { AtomFamilyAtom } from "./types/AtomFamilyAtom"
import type { Selector } from "./types/Selector"
import type { StoreData } from "./types/StoreData"
import { defaultTokenize } from "./utils/defaultTokenize"
import { englishStopWords } from "./utils/englishStopWords"
import { simpleEnglishStem } from "./utils/simpleEnglishStem"

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

export type AtomFamilySearchOptions<Fields extends string = string> = {
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
    name?: string
}

/** Internal field name used when the extractor returns a single string
 *  (the one-field shape). Never user-facing. */
const DEFAULT_FIELD = "__default__"

/** Per-(atom, field) stats: term frequency map and field length, both in
 *  the same units as the index mode (tokens for exact/prefix, trigrams
 *  for trigram). */
type FieldStats = {
    length: number
    termCounts: Map<string, number>
}

/** Per-scope BM25F storage. Lives as the *value* of `bm25Atom` so the
 *  scoring selector can `get(bm25Atom)` to access it without needing
 *  direct `data` access. Mutated in place; `epoch` is bumped on every
 *  change so atom-equality treats the mutation as a real value change.
 *
 *  `parent` points at the parent scope's storage (undefined at root).
 *  Scoring walks the chain to find an atom's stats — local stats
 *  override parent stats (the scope-shadowing case), missing local
 *  stats fall through to the parent (the unshadowed-inheritance case). */
type BM25Storage = {
    perAtom: Map<AtomFamilyAtom<any, any>, Map<string, FieldStats>>
    fieldTotals: Map<string, { totalLength: number; docCount: number }>
    epoch: number
    parent: BM25Storage | undefined
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
// Overload: single-string extractor — no field-name inference needed,
// `fields` keys (if passed) accept any string. Returning `null`,
// `undefined`, or `""` skips indexing for that atom.
export function atomFamilySearch<
    Value,
    Args extends [any, ...any[]] = [any, ...any[]],
>(
    family: AtomFamily<Value, Args>,
    extractor: (value: Value) => string | null | undefined,
    options?: AtomFamilySearchOptions<string>,
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
    options?: AtomFamilySearchOptions<Fields>,
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

    /** Normalize the extractor's return value into a flat `Map<field,
     *  term[]>`. Single-string returns get the `DEFAULT_FIELD` name.
     *  Object returns keep their keys; empty/missing field values are
     *  dropped.
     *
     *  Memoized by value reference: both the tokenIndex descriptor and
     *  the bm25Descriptor receive the same `value` from
     *  `data.values.get(atom)` within one propagation pass, so the
     *  second call hits the cache and the user's `extractor` runs once
     *  per write, not twice. WeakMap-keyed by value so entries are
     *  reclaimed when the atom's value reference is replaced — bulk
     *  transaction writes (atom1, atom2, …, atomN) cache N distinct
     *  values during pass 1, then hit them during pass 2 without
     *  re-running the extractor.
     *
     *  Note: primitive value types (string, number) can't be WeakMap
     *  keys, so for those the cache is skipped and the extractor runs
     *  per descriptor as before — but that's the cheap case anyway. */
    const memo = new WeakMap<object, Map<string, string[]>>()
    const isObjectLike = (v: unknown): v is object =>
        v !== null && (typeof v === "object" || typeof v === "function")
    const extractFieldTerms = (value: Value): Map<string, string[]> => {
        if (isObjectLike(value)) {
            const cached = memo.get(value)
            if (cached) return cached
        }
        const raw = extractor(value)
        const out = new Map<string, string[]>()
        if (typeof raw === "string") {
            if (raw.length > 0) {
                const terms = expandForWrite(normalize(raw), mode)
                if (terms.length > 0) out.set(DEFAULT_FIELD, terms)
            }
        } else if (raw && typeof raw === "object") {
            for (const field in raw) {
                const text = raw[field]
                if (typeof text !== "string" || text.length === 0) continue
                const terms = expandForWrite(normalize(text), mode)
                if (terms.length > 0) out.set(field, terms)
            }
        }
        if (isObjectLike(value)) memo.set(value, out)
        return out
    }

    /** Token index — set membership across all fields, used to filter
     *  the candidate set before scoring. Built on the existing
     *  `atomFamilyIndex` primitive: extractor flattens all fields'
     *  terms into one Set. */
    const tokenIndex = atomFamilyIndex(
        family,
        value => {
            const fieldTerms = extractFieldTerms(value)
            if (fieldTerms.size === 0) return []
            // Single field — return its terms directly to avoid an array
            // copy. Multi-field — concatenate.
            if (fieldTerms.size === 1) {
                for (const terms of fieldTerms.values()) return terms
            }
            const flat: string[] = []
            for (const terms of fieldTerms.values()) {
                for (const t of terms) flat.push(t)
            }
            return flat
        },
        { name: options?.name },
    )

    /** Per-instance BM25F storage atom. Its *value* is the mutable
     *  storage object (one per store via initAtom/setValueInData). The
     *  scoring selector reads via `get(bm25Atom)`; the descriptor below
     *  mutates the storage in place and bumps `epoch` to invalidate. */
    const bm25Atom: Atom<BM25Storage> = {
        equal: (a, b) => a.epoch === b.epoch,
        defaultValue: () => ({
            perAtom: new Map(),
            fieldTotals: new Map(),
            epoch: 0,
            parent: undefined,
        }),
        name: options?.name ? `${options.name}:bm25` : undefined,
        // Mutable storage — we mutate `perAtom` / `fieldTotals` / `epoch`
        // in place on every write to avoid the cost of cloning a possibly-
        // huge stats map. `equal()` uses the `epoch` field to detect change
        // even though the reference is stable.
        mutable: true,
    }

    /** Lazily initialize the BM25 storage chain for a given store data.
     *  Recurses up: if `data` is a scope, the storage's `parent` points
     *  at the parent scope's storage (initialized if it doesn't exist).
     *  Storage is held as the value of `bm25Atom` in `data.values`. */
    const ensureBM25Storage = (data: StoreData): BM25Storage => {
        let s = data.values.get(bm25Atom) as BM25Storage | undefined
        if (s) return s
        const parent = data.parent
            ? ensureBM25Storage(data.parent)
            : undefined
        s = {
            perAtom: new Map(),
            fieldTotals: new Map(),
            epoch: 0,
            parent,
        }
        setValueInData(bm25Atom, s, data)
        return s
    }

    /** Walk the parent chain looking for the atom's stats. Local stats
     *  override parent stats — this is how scope shadowing works:
     *  `scope.set(a, ...)` puts a's new stats in the scope; subsequent
     *  scope reads stop at the local entry, not the root one. */
    const findAtomFieldStats = (
        storage: BM25Storage,
        atom: AtomFamilyAtom<Value, Args>,
    ): Map<string, FieldStats> | undefined => {
        let s: BM25Storage | undefined = storage
        while (s) {
            const stats = s.perAtom.get(atom)
            if (stats) return stats
            s = s.parent
        }
        return undefined
    }

    /** Sum field totals across the chain. Approximate when atoms are
     *  shadowed (the deeper-scope stats are counted alongside the
     *  outer ones), but BM25's length-normalization tolerates small
     *  drift in `avgdl` without breaking ranking. Good-enough for v1. */
    const getFieldTotal = (
        storage: BM25Storage,
        field: string,
    ): { totalLength: number; docCount: number } => {
        let totalLength = 0
        let docCount = 0
        let s: BM25Storage | undefined = storage
        while (s) {
            const t = s.fieldTotals.get(field)
            if (t) {
                totalLength += t.totalLength
                docCount += t.docCount
            }
            s = s.parent
        }
        return { totalLength, docCount }
    }

    /** Subtract one atom's field stats from `fieldTotals` and decrement
     *  its term refcounts in `termDictionary`. Used both on delete and
     *  on re-write (where we tear down the old contribution before
     *  applying the new). */
    const detachAtomStats = (
        storage: BM25Storage,
        atom: AtomFamilyAtom<any, any>,
    ): boolean => {
        const stats = storage.perAtom.get(atom)
        if (!stats) return false
        for (const [field, fs] of stats) {
            // Decrement term refcounts and drop entries that hit zero,
            // so the dictionary doesn't grow monotonically across
            // rewrites. Only relevant when tolerance > 0 (otherwise we
            // never populated the dictionary in the first place).
            if (tolerance > 0) {
                for (const [term, count] of fs.termCounts) {
                    const remaining = (termDictionary.get(term) ?? 0) - count
                    if (remaining <= 0) {
                        termDictionary.delete(term)
                    } else {
                        termDictionary.set(term, remaining)
                    }
                }
            }
            const tot = storage.fieldTotals.get(field)
            if (!tot) continue
            tot.totalLength -= fs.length
            tot.docCount -= 1
            if (tot.docCount <= 0) {
                storage.fieldTotals.delete(field)
            }
        }
        storage.perAtom.delete(atom)
        return true
    }

    /** Descriptor that maintains the BM25F stats — sits alongside the
     *  `tokenIndex` descriptor on `family.__valdresIndexes`. Both fire
     *  on every write; the tokenIndex handles set-membership, this one
     *  handles per-field TF + length stats. */
    const bm25Descriptor: IndexDescriptor = {
        onWrite: (_family, atom, data, accum) => {
            // Storage is per-scope, with a parent chain for inheritance.
            // Writing in a scope updates *that* scope's stats — root and
            // sibling scopes are unaffected. Reads walk the chain.
            const storage = ensureBM25Storage(data)
            // Tear down old contribution in THIS scope first so
            // re-writes within the scope don't double-count.
            detachAtomStats(storage, atom)

            const value = data.values.get(atom) as Value
            const fieldTerms = extractFieldTerms(value)
            if (fieldTerms.size === 0) {
                bumpBM25Epoch(storage, data, accum)
                return
            }

            const atomStats = new Map<string, FieldStats>()
            for (const [field, terms] of fieldTerms) {
                const termCounts = new Map<string, number>()
                for (const t of terms) {
                    termCounts.set(t, (termCounts.get(t) ?? 0) + 1)
                    // Refcounted: dictionary entry's value is the total
                    // occurrence count across all atoms. `detachAtomStats`
                    // decrements by this atom's contribution on delete /
                    // re-write so the dictionary doesn't leak.
                    if (tolerance > 0) {
                        termDictionary.set(
                            t,
                            (termDictionary.get(t) ?? 0) + 1,
                        )
                    }
                }
                atomStats.set(field, { length: terms.length, termCounts })

                let tot = storage.fieldTotals.get(field)
                if (!tot) {
                    tot = { totalLength: 0, docCount: 0 }
                    storage.fieldTotals.set(field, tot)
                }
                tot.totalLength += terms.length
                tot.docCount += 1
            }
            storage.perAtom.set(atom, atomStats)
            bumpBM25Epoch(storage, data, accum)
        },
        onDelete: (_family, atom, data, accum) => {
            const storage = data.values.get(bm25Atom) as
                | BM25Storage
                | undefined
            if (!storage) return
            const removed = detachAtomStats(storage, atom)
            if (removed) bumpBM25Epoch(storage, data, accum)
        },
    }

    const bumpBM25Epoch = (
        storage: BM25Storage,
        data: StoreData,
        accum: IndexHookResult,
    ) => {
        storage.epoch++
        setValueInData(bm25Atom, storage, data)
        if (!accum.local) accum.local = new Set()
        accum.local.add(bm25Atom)
    }

    if (!family.__valdresIndexes) family.__valdresIndexes = new Set()
    family.__valdresIndexes.add(bm25Descriptor)

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

    // Per-query selector caches, keyed by query string. These grow
    // monotonically for the lifetime of the search instance — one entry
    // per distinct query ever issued. For search-as-you-type / unbounded
    // distinct queries this is a deliberate leak with an escape hatch:
    // call `releaseQuery(q)` to drop one, or `releaseAllQueries()` to
    // clear all (next read re-allocates). Bounded-query apps never need
    // either. A future LRU cap could automate this if it bites.
    const scoredCache = new Map<
        string,
        Selector<ScoredResult<Value, Args>[]>
    >()
    const atomsCache = new Map<
        string,
        Selector<AtomFamilyAtom<Value, Args>[]>
    >()

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
        // exact / prefix: optionally expand to tolerance-neighbors
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

    /** Per-instance term dictionary with refcounts. Populated by the BM25
     *  descriptor's write hook; entries are decremented by
     *  `detachAtomStats` and removed when the count hits zero. Used by
     *  `expandSingleToken` when `tolerance > 0` to find indexed terms
     *  within edit distance K of the query token. One shared dictionary
     *  across scopes — terms-as-data are the same regardless of which
     *  scope wrote them.
     *
     *  The refcount is the total occurrence count across every atom
     *  that holds this term (i.e. sum of per-(atom, field) `termCounts`
     *  entries for this term). Rewriting an atom subtracts its old
     *  contribution before adding the new — see `detachAtomStats`. */
    const termDictionary = new Map<string, number>()

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

    /** Expand a query token to all indexed terms within `tolerance`
     *  edits, each tagged with a distance-based penalty. The original
     *  token is always included with penalty 1.0 (so exact matches
     *  still hit even if the token isn't in the dictionary).
     *  Cost: O(|dictionary|) — naive walk. BK-tree would be sublinear
     *  but ~80 lines more code; revisit if vocabs of 100k+ become
     *  common. */
    const expandToleranceMatches = (token: string): ExpandedTerm[] => {
        if (tolerance === 0) return [{ term: token, penalty: 1 }]
        const matches: ExpandedTerm[] = [{ term: token, penalty: 1 }]
        for (const term of termDictionary.keys()) {
            if (term === token) continue
            const d = levenshtein(token, term, tolerance)
            if (d <= tolerance) {
                matches.push({ term, penalty: 1 / (1 + d) })
            }
        }
        return matches
    }

    const computeScored = (query: string) => {
        const queryTokens = normalize(query)
        // Denominator for the coordination factor: distinct normalized
        // query terms. A doc that matched all of them gets full score; one
        // matching a subset is scaled down toward `1 - coordination`.
        const distinctQueryTerms = new Set(queryTokens).size
        const queryName = options?.name
            ? `${options.name}:scored:${query}`
            : undefined

        return selector<ScoredResult<Value, Args>[]>(
            get => {
                if (queryTokens.length === 0) return []
                const typedGet = get as <V>(s: Atom<V>) => V
                const N = Math.max(family.__valdresAtomFamilyMap.size, 1)

                // Subscribe to BM25 storage updates and grab the current
                // mutable storage object. Stats are read freshly inside
                // the scoring loop below.
                const bm25Storage = typedGet(bm25Atom)

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

                for (const queryToken of queryTokens) {
                    const terms = expandSingleToken(queryToken)
                    totalQueryTerms += terms.length
                    const tokenMatched = new Set<AtomFamilyAtom<Value, Args>>()
                    for (const { term, penalty } of terms) {
                        const bucket = getTokenSet(term, typedGet)
                        if (bucket.size === 0) continue
                        const df = bucket.size
                        for (const atom of bucket) {
                            // Sum BM25F contributions across the atom's
                            // fields. Walk the parent chain: closest
                            // scope's stats win (scope shadowing).
                            const atomFields = findAtomFieldStats(
                                bm25Storage,
                                atom,
                            )
                            if (!atomFields) continue
                            let termScore = 0
                            for (const [field, fs] of atomFields) {
                                const tf = fs.termCounts.get(term) ?? 0
                                if (tf === 0) continue
                                const tot = getFieldTotal(
                                    bm25Storage,
                                    field,
                                )
                                if (tot.docCount === 0) continue
                                const avgdl =
                                    tot.totalLength / tot.docCount
                                // `penalty` < 1 for typo'd matches —
                                // restores intuitive "exact > fuzzy"
                                // ranking. Always 1 for non-tolerance.
                                termScore +=
                                    penalty *
                                    fieldBoost(field) *
                                    bm25Score(
                                        tf,
                                        df,
                                        N,
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
    // Test-only backdoor — DELIBERATELY not on the public AtomFamilySearch
    // type, reached only via cast from `atomFamilySearch.test.ts`'s
    // tolerance/termDictionary refcount tests to assert the dictionary
    // shrinks on delete/rewrite (it has no observable effect otherwise).
    // Not part of the public API; do not rely on it.
    ;(result as unknown as { __dictionarySize: () => number }).__dictionarySize =
        () => termDictionary.size
    return result
}
