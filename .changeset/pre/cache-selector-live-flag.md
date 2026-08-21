---
"valdres": minor
---

Replace the per-call upward walk in `isTransitivelySubscribed` with a cached
liveness flag (`liveDependentCount`) maintained incrementally on
sub/unsub and on dependency add/remove events. Selector evaluation paths
that previously walked the dependents graph upward on every dep change now
do an O(1) check, with propagation amortized across topology changes
instead of repeated on every re-evaluation.
