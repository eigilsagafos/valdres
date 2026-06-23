---
"valdres": patch
---

Bound wide-fan-in selector re-evaluation under dynamic dependencies (regression
in 1.0.0-beta).

The topological propagation walk derives a per-node `pending` count (how many
in-closure parents are still dirty) from a snapshot taken before the walk, but
`advance` decrements against the live `stateDependents`, which dynamic
(conditional) dependencies mutate mid-walk. When a re-evaluation adds an edge to
an already-counted in-closure parent, that parent decrements the node twice,
driving `pending` negative and re-pushing the node once per extra parent. For a
subscribed wide-fan-in aggregator over a dynamic-dep subgraph, that compounds
into roughly one re-evaluation per dependency — e.g. a single aggregator
evaluated ~2,000 times (vs ~once) on one commit, dominated by the redundant
family-key serialization each wasted pass re-runs.

The walk now evaluates each selector at most once: finalizing a node deletes
its `pending` entry, so a re-push (a desynced count going non-positive again) is
a no-op pop. The genuine re-evaluation a graph mutation can still require — a
parent that settles to a new value out of topological order (e.g. an orphan
lazily re-initialized mid-walk) — is handed to the existing fixpoint settle pass
instead of being re-pushed, so correctness under dynamic-dep churn is preserved
(escaped/stranded nodes still re-settle). Eval count is now bounded by the actual
churn, not by fan-in width; the steady-state fast path is unchanged and the cap
adds no extra allocation.
