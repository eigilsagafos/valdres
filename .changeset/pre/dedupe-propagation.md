---
"valdres": patch
---

Topologically schedule downstream selector re-evaluation during propagation
so each transitive (non-initial) selector runs its `get` at most once per
transaction commit. The previous BFS-by-depth pass recomputed any selector
reachable through paths of differing lengths once per depth — a sink
reading both an atom directly and a chain of intermediate selectors
derived from that atom previously evaluated `chainLen + 1` times.

The initial dirty sweep keeps the legacy linear pass so flat-fan-out and
init-only chain initialization (where re-evaluations almost always produce
unchanged values) pay zero topo overhead. The topo pass only runs when at
least one initial selector's value actually shifted, so workloads that
don't benefit from dedup don't pay for it.
