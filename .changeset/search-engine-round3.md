---
"valdres": minor
---

`atomFamilySearch` round-3 improvements:

- **Query-time field weights** — `search(query, { weights: { title: 3, body: 1 } })`
  (also on `scored`) overrides the construction-time per-field boosts for a
  single query, so one index can serve different ranking needs (weight `title`
  heavily for one search, `body` for another). Fields absent from `weights`
  keep their construction boost. Works on every path — full ranking, paginated
  slices, and WAND top-K (the max-impact bound stays valid under weighting, so
  pruning is still exact; verified by an added WAND-vs-naive parity variant).
  Each `(query, weights)` pair caches independently and `releaseQuery(query)`
  still reclaims its weighted variants.

- **Facet filtering + faceted counts** — a `facets` option maps each document
  to categorical values (`facets: p => ({ category: p.category, tags: p.tags })`).
  `search(query, { filter })` then restricts results by facet value (AND across
  facet fields, OR within a field's listed values), and
  `search.facets(query, fields?)` returns reactive counts per value
  (`{ category: { books: 3, film: 1 } }`) over the full match set — for
  building filter UIs. Both read the facet extractor reactively at query time,
  so they're scope-correct and update when a doc's facet value changes; writes
  are unaffected (no extra index). New public `SearchPage.filter` and a
  `facets()` method. Verified by a 400-mutation differential test (filtered
  results == unfiltered results filtered by the same predicate) plus scope /
  reactivity / weights-composition tests.
