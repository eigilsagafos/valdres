---
"valdres": minor
---

Three new insertion-time primitives for `atomFamily`, sharing one `IndexDescriptor` protocol — and a cross-cutting performance fix for bulk family writes.

**New public APIs**

- `atomFamilyIndex(family, extractor)` — equality-bucket index (`postsByTag("foo")` resolves to the atom list).
- `atomFamilySort(family, keyFn, { direction })` — incrementally maintained sorted view (O(N) per write for splice, see source comment for the actual contract).
- `atomFamilySearch(family, extractor, options)` — full-text search with **BM25F ranking** (single algorithm, opinionated, no toggle — matches Orama's design), three modes (`exact` / `prefix` / `trigram`), Levenshtein typo tolerance, field-aware extractor, per-field boost, language preset (string `"english"` or `LanguagePreset` object), stemming, stop words, accent folding, and a `scored(query)` API for relevance metadata.
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

**⚠️ Behavior change — `isProd()` (NODE_ENV=production handling)**

`isProd()` previously hardcoded `return false`, so `setValueInData`'s `deepFreeze` pass ran in every build regardless of `NODE_ENV`. This release honors `NODE_ENV=production` correctly: production builds skip the freeze for performance, dev/test builds still freeze.

**Silent state corruption risk for upgraders.** Apps that mutate atom values in place were previously caught with a `TypeError` in dev *and* prod. After upgrading, in prod they will *silently corrupt state* (mutations are no longer caught; the freeze that was masking the bug is gone). Symptoms typically look like flaky reactivity, not a clear crash.

**Audit checklist before deploying to production:**

1. Search your codebase for direct mutation of values returned from `store.get(atom)`: `arr.push(...)`, `obj.key = ...`, `set.add(...)`, etc.
2. Replace with immutable updates (`[...arr, x]`, `{ ...obj, key: x }`, etc.), or
3. Mark the affected atoms with `{ mutable: true }` to opt into mutation (which is then your responsibility to make safe).
4. Run your app under dev mode (without `NODE_ENV=production`) — the freeze will still catch in-place mutations there as a `TypeError`, so any path that was silently relying on the old behavior surfaces immediately.

There is no flag to restore prod-time freezing. The dev escape hatch `globalThis.__valdres_dev_skip_freeze__` only *disables* freezing in dev; it cannot re-enable freezing in prod. To keep freeze-on-write in a non-dev environment, build without `NODE_ENV=production`.

**Other behavioral notes**

- `data.values.get(family)` is no longer guaranteed-fresh after a write (lazy-render). Internal callers only read `.__index` (always fresh). External code reaching directly into `data.values` should go through `store.get(family)`.
- Root-level `store.del(familyAtom)` now removes the atom from `index.created` entirely (previously left a tombstone in `index.deleted`, leaking the atom).

**Internal hardening (no API change)**

- `equal()` and `stableStringify()` cycle detection now uses `instanceof RangeError` (Chrome/Safari/Edge) + `name === "InternalError"` (Firefox) instead of `/stack|recursion/i.test(error.message)`. Previously, user-thrown errors whose messages contained those substrings were silently swallowed.
- `atomFamilySearch` extractor memo switched to per-value `WeakMap` so bulk-write transactions call the user's extractor exactly once per atom instead of twice (two descriptors, two passes — the previous single-slot cache thrashed).
- `atomFamilySearch` Levenshtein tolerance dictionary is now refcounted — rewrites and deletes correctly shrink the dictionary instead of growing it monotonically.
- `atomFamilySort` ascending tiebreak by `familyArgsStringified` is now stable across both `asc` and `desc` directions (previously inverted under `desc`).
