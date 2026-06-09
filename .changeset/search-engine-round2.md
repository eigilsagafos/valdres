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

New public types `SearchPage` and `SearchStats`.
