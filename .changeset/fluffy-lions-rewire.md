---
"valdres": patch
---

Cut the graph re-wiring cost of unmount/remount by ~10%.

`#337` removed selector re-evaluation from unmount/remount but left the
subscribe/unsubscribe graph work itself expensive. Four changes to the paths a
remount actually walks, none of which alter observable behaviour:

- `propagateLive` / `propagateNotLive` walk the root's own edges without a
  traversal array and allocate one only on a genuine cascade. Re-subscribing
  siblings that share an already-live aggregator no longer allocates at all.
- `subscribe` hoists the cold-cache freshness test that `getState` would apply
  anyway, so promoting a selector whose cache is still valid at the current tree
  revision skips the call and the two traversal accumulators it needs. Mirrors
  the same hoist already present in `getState` and at the store boundary.
- Orphan teardown releases the reverse edge and enqueues the dependency in one
  pass instead of walking the same dependency set twice.
- `activateSelectorGraph` skips already-active selectors at push time, so
  promotion that reaches a still-live shared aggregator never allocates a stack.

`livenessWorkAllocations` is now incremented at the allocation rather than on
function entry, so the architecture gates keep reporting containers actually
created — three of them drop as a result.
