---
"valdres": patch
---

Fix a dependency-tracking bug where a selector that reads the **same dependency
more than once in a single evaluation** could fail to drop a dependency it
stopped reading.

`evaluateSelector` detected dependency-set changes by comparing the previous
dependency count to the number of `get(...)` calls this evaluation. Because that
count included duplicate reads, a branch like
`cond ? get(a) + get(b) : get(a) + get(a)` evaluated to the same count (2) as the
previous `{a, b}` (2), so the removal of `b` went undetected — leaving a stale
reverse-dependency edge (and an inflated live-dependent count) on `b`, so writes
to `b` kept waking the selector.

Dependencies read during an evaluation are now tracked in a `Set`, so
change-detection compares deduplicated sizes and the stale edge is removed
correctly. (Also removes the previous array→Set conversion.)
