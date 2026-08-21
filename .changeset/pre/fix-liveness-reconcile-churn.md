---
"valdres": patch
---

Fix a family of `liveDependentCount` desyncs that left selectors mis-marked as
live or non-live after dependency-graph churn — most visibly a UI freeze when a
subscribed selector's transitive dependency stopped being re-evaluated, and a
slow "leak" where a cyclic group of selectors stayed live after losing its only
subscriber.

The live-dependent count was maintained as an incremental reference count, which
cannot collect cyclic selector groups (mutual references keep each other's count
above zero) and was fragile to maintain across the many paths that mutate the
dependency graph (a subscribe, an unsubscribe, a dependency-set change during
propagation, or a selector re-materialized lazily through `get`). The symptoms:
selectors transitively read by a live subscriber could be left non-live and stop
recomputing (stale value), and cyclic groups could be left live forever.

Liveness is now reconciled from ground-truth reachability (a fixpoint that is
correct for cycles by construction) over exactly the region whose dependency set
changed, at each of the events that can change liveness. The reported scrub
freeze, recursive-selectorFamily cycles, direct self-cycles, throwing
dependencies, and dynamic-dependency churn are all covered. No public API change.
