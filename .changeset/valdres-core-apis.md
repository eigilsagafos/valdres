---
"valdres": minor
---

Three new insertion-time primitives for `atomFamily`, sharing one `IndexDescriptor` protocol — and a cross-cutting performance fix for bulk family writes.

**New public APIs**

- `atomFamilyIndex(family, extractor)` — equality-bucket index (`postsByTag("foo")` resolves to the atom list).
- `atomFamilySort(family, keyFn, { direction })` — incrementally maintained sorted view (O(N) per write for splice, see source comment for the actual contract).
- `atomFamilySearch(family, extractor, options)` — full-text search with **BM25F ranking** (single algorithm, opinionated, no toggle — matches Orama's design), three modes (`exact` / `prefix` / `trigram`), Levenshtein typo tolerance, field-aware extractor, per-field boost, a **coordination factor** (`coordination`, default `0.5`) that rewards docs matching more of the distinct query terms so multi-word relevance doesn't get dominated by a single rare term, language preset (string `"english"` or `LanguagePreset` object), stemming, stop words, accent folding, and a `scored(query)` API for relevance metadata.
- Extractor signature accepts `null | undefined` (returns or per-field values) to skip indexing.

**New public utilities** (all in `valdres`)

- `defaultTokenize` — Unicode word-split tokenizer.
- `englishStopWords` — conservative 67-word default set.
- `simpleEnglishStem` — small rule-based stemmer.
- `foldAccents` — diacritic stripper for accent-insensitive matching.
- `LanguagePreset` type — `{ tokenize, stem, stopWords }` shape that `@valdres/search-languages` implements.
- `bm25Score` / `DEFAULT_BM25` / `BM25Params` — pure BM25(+) scoring function with tunable `k1` / `b` / `d`.
- `levenshtein(a, b, max)` — edit-distance with length pre-filter and per-row early exit.

**Lazy family rendering** (perf fix that benefits ALL `atomFamily` users, not just descriptor consumers)

Bulk no-txn writes drop from O(N²) to O(N). Writes mark the family dirty; the first read materializes the rendered array. Concrete numbers from the bench suite:

- txn bulk-set 1k: 44.8ms → 1.6ms (**28×**)
- txn bulk-set 10k: 2,696ms → 14.2ms (**190×**)
- no-txn per-call set 10k: 2,648ms → 8.4ms (**315×**)
- Single set into populated family: 424µs → 14µs (**30×**)

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
