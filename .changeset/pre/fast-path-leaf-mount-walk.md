---
"valdres": patch
---

Skip the transitive mount/unmount walk when the start state is a leaf with no
`onMount`. The walk allocates a `Set` and `Array` and was firing on every
selector dep change during propagation, even when the dep was a plain atom
with no mountable subtree — which is the common case. The cached liveness
flag (#134) already makes the upstream check O(1), but the downstream
`mountTransitiveDeps(dep)` / `unmountOrphanedDeps(dep)` calls still walked
the subtree from each added/removed dep. On the new propagation bench
(median of 5 runs) this trims ~6% off the load-entity integration shape
(200 subscribed selectors, churning deps) and ~7-8% off the dep-churn
microbench.

Also adds `packages/valdres/test/performance/propagation.bench.ts` covering
plain fan-out, dep churn, structured family args, and a load-entity
integration shape, so future regressions in propagation are caught
automatically.
