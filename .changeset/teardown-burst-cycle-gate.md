---
"valdres": patch
---

Fix the unsubscribe/teardown performance regression that made synchronous
unsubscribe bursts (e.g. React unmounting a large subtree) cost
O(unsubs × shared dependency closure). Every selector unsubscribe used to run
an unconditional `regionHasCycle` DFS over its full downward dependency
closure to gate the cyclic-liveness reconcile — ~16–25× slower per
unsubscribe than 0.2.x on cycle-free graphs (the overwhelmingly common case).

The cycle gate is now driven by a sticky per-store `depGraphMaybeCyclic` flag
maintained at dependency-edge commit time: a cycle can only come into
existence when its closing edge is committed, and that commit is detectable
in O(1) (the committing selector already has dependents), so the O(closure)
probe runs once per potentially-cycle-closing commit instead of once per
unsubscribe. While the flag is false, unsubscribe teardown and the
removal-armed end-of-pass reconcile skip their cycle walks entirely; once a
cycle is committed the exact per-region gate runs as before. Teardown also
skips the orphan unmount/cleanup sweeps when the unsubscribed state is still
transitively subscribed (a live root's downward closure is provably live, so
both sweeps are no-ops).

Per-unsubscribe cost in a teardown burst drops ~3–4× on the regression
benchmark (and the burst is now O(states removed), matching 0.2.x scaling),
with cyclic-graph semantics unchanged: eager onUnmount timing and
cyclic-group liveness reconciliation are preserved.
