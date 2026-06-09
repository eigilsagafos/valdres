---
"valdres": minor
---

`atomFamilySearch` round-2 improvements:

- **Faster scoring** — IDF and `avgdl` are hoisted out of the per-document
  loop (computed once per term / per field instead of once per matching doc).
- **`search.suggest(prefix, limit?)`** — autocomplete completions ranked by
  document frequency, from the whole-word vocabulary (prefix mode / tolerance).
- **`search.highlight(query, text, { merge? })`** — `highlightMatches` bound to
  the instance's tokenizer/stemmer/mode so highlights line up with hits.
- **Pagination** — `search(query, { offset, limit })` and `scored(query, {
  offset, limit })`. The full ranking is computed once per query and cached;
  pages are cheap slices (no re-scoring).
- **`search.stats`** — a reactive selector resolving to `{ documentCount,
  fields: { [field]: { documentCount, averageLength } } }`.
- **Unified search index (internal)** — the inverted buckets and the BM25F
  stats are now maintained by a single descriptor in one write pass over one
  per-atom record (previously two descriptors). ~20% faster insertion, same
  behavior (verified by a differential fuzzer against a brute-force oracle).
- **WAND top-K retrieval (internal)** — ranked queries with a `limit` skip
  scoring documents that can't enter the top-K (per-term max-impact pruning).
  ~2.8× faster on a high-frequency query over 8k docs; identical results
  (verified WAND-vs-naive by the differential fuzzer). Applies to ranked,
  limited, `exact`/`prefix`, non-phrase queries at the root store; everything
  else uses the full ranking unchanged.

New public types `SearchPage` and `SearchStats`.
