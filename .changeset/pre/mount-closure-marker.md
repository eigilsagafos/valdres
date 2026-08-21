---
"valdres": patch
---

Fix a dependency-churn performance regression in the 1.0 liveness subsystem. The
propagation rewrite made eval/propagation ~4× faster, but the new mount/unmount
graph-walk (`mountTransitiveDeps` / `unmountOrphanedDeps`) walked the full
transitive dependency subtree on every dependency edge a live selector gained or
lost — even when nothing in that subtree had an `onMount` hook. On
churn-heavy workloads (e.g. collapsing a deep decision tree that re-points
thousands of layout dependencies) those walks dominated, erasing the rewrite's
gain and then some.

Each state now caches whether its downward dependency closure contains any
mountable (`onMount` / `__valdresOnMount`) state, in a per-store `mountInClosure`
marker. When a state's closure is mount-free — the common case for derived/layout
selectors — the mount and unmount walks return immediately, before any allocation
or traversal. The marker is set and propagated up on every dependency-edge add
(no false negatives: a reachable mount hook is always marked); edge removals need
no maintenance (a stale-true marker only costs a redundant, self-clearing walk,
never a missed mount), which keeps the fix off the cyclic-reconcile path. A
standalone walk that finds its subtree mount-free clears the stale marker.

Mounts and unmounts fire exactly as before through dependency cycles, scopes,
global atoms, and async/late dependencies. This also pins down the long-standing
`onMount` contract: a mount hook must be set before the atom/selector is first
used in a store (at creation, or assigned afterward but before first use — as the
Jotai adapter does). Assigning `onMount` after the state is already participating
in a store was never a guaranteed pattern and is now documented as unsupported,
which is what lets the marker be trusted on every path.
