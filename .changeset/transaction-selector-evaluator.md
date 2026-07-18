---
"valdres": patch
---

Make transaction selector reads use the standard selector evaluation boundary,
including schema validation, cycle detection, abort options, wrapped errors,
and async dependency tracking. Keep selector bookkeeping isolated from committed
store state, invalidate transaction selector caches for every write operation,
and reject Promise-like transaction callbacks before automatic commit.
