---
"valdres": minor
---

Three new insertion-time primitives for `atomFamily`, sharing one `IndexDescriptor` protocol — and a cross-cutting performance fix for bulk family writes.

**New public APIs**

- `atomFamilyIndex(family, extractor)` — equality-bucket index (`postsByTag("foo")` resolves to the atom list).
- `atomFamilySort(family, keyFn, { direction })` — incrementally maintained sorted view (O(N) per write for splice, see source comment for the actual contract).
- `atomFamilySearch(family, extractor, options)` — full-text search with **BM25F ranking** (single algorithm, opinionated, no toggle — matches Orama's design), three modes (`exact` / `prefix` / `trigram`), Levenshtein typo tolerance, field-aware extractor, per-field boost, a **coordination factor** (`coordination`, default `0.5`) that rewards docs matching more of the distinct query terms so multi-word relevance doesn't get dominated by a single rare term, **quoted-phrase search** (`positions: true`), language preset (string `"english"` or `LanguagePreset` object), stemming, stop words, accent folding, a bounded **LRU query cache** (`queryCacheSize`, default `500`), and a `scored(query)` API for relevance metadata.
  - `mode: "prefix"` indexes **whole words** and resolves a query token to the indexed words it prefixes at query time (Lucene-style prefix → OR of term queries). The index is the same size as `exact` mode — no per-word-length explosion — and each matched word carries its own df/TF into ranking, so a rare completion outranks a common one.
  - `positions: true` maintains a positional index so a double-quoted run in the query (`"exact phrase"`) becomes an adjacency constraint: the words must appear consecutively, in order, within one field. `exact` / `prefix` modes only.
  - `tolerance` (fuzzy) resolves via a **BK-tree** — sublinear edit-distance lookup instead of a linear vocabulary walk.
  - `queryCacheSize` bounds the per-query selector caches with an LRU (`0` / `Infinity` = unbounded). Sized for search-as-you-type.
- Extractor signature accepts `null | undefined` (returns or per-field values) to skip indexing.

**New public utilities** (all in `valdres`)

- `defaultTokenize` — Unicode word-split tokenizer.
- `englishStopWords` — conservative 67-word default set.
- `simpleEnglishStem` — small rule-based stemmer.
- `foldAccents` — diacritic stripper for accent-insensitive matching.
- `highlightMatches(text, query, options)` — returns the character ranges in a text that match a query (`HighlightRange[]`), for highlighting search hits. Self-contained (operates on the raw text the caller already has), stem/stop-word/mode aware, with an optional `merge` to collapse an adjacent matched run into one span.
- `LanguagePreset` type — `{ tokenize, stem, stopWords }` shape that `@valdres/search-languages` implements.
- `bm25Score` / `DEFAULT_BM25` / `BM25Params` — pure BM25(+) scoring function with tunable `k1` / `b` / `d`.
- `levenshtein(a, b, max)` — edit-distance with length pre-filter and per-row early exit.

**Lazy family rendering** (perf fix that benefits ALL `atomFamily` users, not just descriptor consumers)

Bulk no-txn writes drop from O(N²) to O(N). Writes mark the family dirty; the first read materializes the rendered array. Concrete numbers from the bench suite:

- txn bulk-set 1k: 44.8ms → 1.6ms (**28×**)
- txn bulk-set 10k: 2,696ms → 14.2ms (**190×**)
- no-txn per-call set 10k: 2,648ms → 8.4ms (**315×**)
- Single set into populated family: 424µs → 14µs (**30×**)

**Search engine performance**

- **Whole-word prefix index.** `mode: "prefix"` no longer explodes every prefix of every word into the inverted index. Indexing a 5k-doc corpus in prefix mode dropped from ~254ms to ~20ms (now equal to `exact` mode), with proportional posting/memory reduction.
- **Sublinear fuzzy.** `tolerance` matching uses a BK-tree instead of a linear vocabulary walk: ~5.7× faster per query at `tolerance: 1` (the common case) on a 50k-word vocabulary, identical results.
- **Shared term-frequency pass.** The token index and BM25 stats share one term-count computation per write (~5% faster insertion on realistic documents).
- **Bounded query cache.** The per-query selector caches are LRU-capped (`queryCacheSize`, default 500) so search-as-you-type no longer grows them without limit.

`atomFamilySort`'s O(N)-per-write splice is unchanged — reviewed and deliberately deferred (no workload evidence it bites).

**Behavioral notes**

- `data.values.get(family)` is no longer guaranteed-fresh after a write (lazy-render). Internal callers only read `.__index` (always fresh). External code reaching directly into `data.values` should go through `store.get(family)`.
- Root-level `store.del(familyAtom)` now removes the atom from `index.created` entirely (previously left a tombstone in `index.deleted`, leaking the atom).

**Internal hardening (no API change)**

- `equal()` and `stableStringify()` cycle detection now uses `instanceof RangeError` (Chrome/Safari/Edge) + `name === "InternalError"` (Firefox) instead of `/stack|recursion/i.test(error.message)`. Previously, user-thrown errors whose messages contained those substrings were silently swallowed.
- `atomFamilySearch` extractor memo switched to per-value `WeakMap` so bulk-write transactions call the user's extractor exactly once per atom instead of twice (two descriptors, two passes — the previous single-slot cache thrashed).
- `atomFamilySearch` Levenshtein tolerance dictionary is now refcounted — rewrites and deletes correctly shrink the dictionary instead of growing it monotonically.
- `atomFamilySearch` tolerance now skips query tokens of `tolerance + 2` chars or fewer — edit-distance-1 on a 3-char token matches a huge neighborhood (and in `prefix` mode the dictionary is full of short prefixes, so `"str"` fuzzed into `"sto"`→storm, etc., matching most of the corpus). Short tokens match exactly / by prefix only; real typos in longer words still correct.
- `atomFamilySearch` BM25 length normalization now uses the raw word count, not the mode-expanded term count. In `prefix`/`trigram` mode the expansion size scales with word length, so the old behavior penalized documents merely for containing longer words (a title "The Eternal Stranger" scored its terms lower than "The Eternal City" purely because "Stranger" → 8 prefixes vs "City" → 4). Matching the standard-BM25 / Orama convention makes title matches rank correctly for partial queries like "the eternal str".
- `atomFamilySort` ascending tiebreak by `familyArgsStringified` is now stable across both `asc` and `desc` directions (previously inverted under `desc`).
