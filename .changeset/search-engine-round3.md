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
