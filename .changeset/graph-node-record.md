---
"valdres": patch
---

perf: hold per-node graph metadata in one record instead of six parallel tables

`liveDependentCount`, `mountInClosure`, `cycleRiskInClosure`, `dependencyOrder`,
`acyclicDependencyVersion` and `orphanCleanupVersion` were six WeakMaps keyed by
the same states. Every graph operation that matters is a walk over a dependency
closure, and each node of that walk needs several of those fields at once —
`noteDependencyAdded` alone read `dependencyOrder` twice, `cycleRiskInClosure`
once and `mountInClosure` twice, so committing one edge cost six WeakMap lookups
where one lookup plus five field reads would do.

They are now one `GraphNode` record per state, reached only through
`peekGraphNode` / `graphNodeFor`. Reads never allocate: an absent record means
every field is at its default, which is also how `live === 0` replaces the old
table's "absent" spelling.

This is a contained change with no semantic difference — same walks, same
stopping conditions, same invariants — so it is a straight constant-factor win
on the subscribe/unsubscribe path. The graph-boundary guard gains a stronger
rule to compensate for the fact that a field assignment is invisible to its
mutating-method scan: `data.graphNodes` is now asserted to be touched by its
accessor module alone.
