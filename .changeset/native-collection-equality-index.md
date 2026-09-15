---
"valdres": patch
---

Declare non-unique scalar equality indexes on collections and read matching rows
with `query` from `valdres/query`. Indexes materialize lazily and update from
effective scoped row changes, preserving membership order, atomic rollback and
stable result snapshots.
