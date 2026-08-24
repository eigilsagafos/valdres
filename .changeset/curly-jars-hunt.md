---
"valdres": patch
---

Cut the per-read cost of already-cached selector reads, for consumers whose
traversals read the same members many times per pass.

- `selectorFamily(...)` member resolution now uses the same accessor shape
  `atomFamily` already had — a small cache-hit path with member construction
  split into a separate `build()`. A single-string-argument hit goes from
  ~16 ns to ~4.6 ns.
- `getState` hoists the cold-cache revision check that `isColdSelectorCacheFresh`
  performs first anyway, so a validated cold read returns without two extra calls.
- A selector body re-reading a dependency it has already read this evaluation
  no longer repeats the dependency-membership lookup.
- The store's `get` boundary resolves a cold cache entry with one `WeakMap`
  lookup instead of `has()` + `get()`.

Measured on a 200-member three-level `selectorFamily` graph, reading cached
members 1M times inside one evaluation: `get(family(id))` 45.7 → 28.4 ns/read,
a three-level chain 48.4 → 30.1 ns/read.
