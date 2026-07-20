---
"valdres": patch
---

Make `index()` term identity collision-safe and stop one-off queries from being
retained for the lifetime of the index. Terms now use the same canonical key
codec as atom and selector families, with a new `keyOf` option for unsupported
or intentionally grouped terms. Cached term selectors are weakly held and their
serialized keys are removed after collection.

Document `index()` as a reactive family filter rather than a materialized
database index: predicate work is incremental and unchanged results stop in
O(1), but preserving its ordered array result requires an O(family size) walk
when query membership changes.
