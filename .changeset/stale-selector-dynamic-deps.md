---
"valdres": patch
---

Fix stale selectors after dynamic-dependency changes (regression in 1.0.0-beta.4).

The topological selector-update propagation introduced in beta.4 builds a static
closure and per-node `pending` counts before the walk, assuming the dependency
graph is fixed for its duration. A selector re-evaluated out-of-band during the
walk — most commonly lazily re-initialized via `get` when another selector reads
it after its value was dropped by orphan-invalidation/unsubscribe — mutates the
graph mid-walk. That left two classes of node permanently stale: nodes
materialized after the closure was built ("escaped"), and nodes that dropped a
snapshotted dependency so their `pending` never drained ("stranded").

This surfaced in apps with conditional ("dragging" vs "settled") selector
branches that swap dependencies on interaction: after toggling a branch and
back, derived selectors could return values computed from inputs that no longer
applied. `advance()` now pulls escaped dependents into the closure, and a
fixpoint settle pass re-evaluates stranded nodes (and their dependents). The
steady-state fast path is unaffected — the settle only runs when a stall is
actually detected.
