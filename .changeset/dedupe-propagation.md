---
"valdres": patch
---

Topologically schedule selector re-evaluation during propagation so each
selector reachable from the initial dirty set runs its `get` at most once
per transaction commit. The previous BFS-by-depth pass recomputed any
selector reachable through paths of differing lengths once per depth — a
sink reading both an atom directly and a chain of intermediate selectors
derived from that atom previously evaluated `chainLen + 1` times.
Topological scheduling collapses those to a single evaluation.

Flat-fan-out workloads (initial dirty selectors with no downstream) take a
zero-overhead fast lane that matches the legacy BFS first iteration.
