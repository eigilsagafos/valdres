---
"valdres": patch
---

perf: stop cold-selector revalidation from re-walking the graph on every read

A cold selector snapshot recorded the tree-wide revision it was validated at, and
a validation walk advances that same clock every time it re-materializes a stale
dependency. So one re-evaluation aged every sibling snapshot the walk had already
validated, and each of those re-walked its entire dependency closure — making a
cold read superlinear in graph size. A deep, shared, scoped selector graph under
write churn spent effectively all of its time deciding whether cached values were
still valid and almost none producing them: 102,241 dependency-revision
comparisons for one write-then-read over a graph with 7,020 edges, with the
existing O(1) shortcut hitting zero times.

Snapshots are now also stamped with a validation *pass* — a generation that does
not move for the walk's own materializations — so each snapshot in a closure is
validated at most once per read burst, and repeated top-level reads of an
unchanged graph cost nothing. On a 10-layer shared graph read through 60 roots
this cuts a cold read pass by 2.5x, and the gain grows with depth (4.3x at 16
layers) because the superlinear term is gone rather than reduced. Cold reads are
now cheaper than live ones instead of more expensive. Live/subscribed reads, which
never validate a cold snapshot, are unchanged.

The pass ends the moment anything changes that the walk did not derive itself — a
write re-entering the store from a selector body, a lazy atom default resolving,
an async settlement, a late async dependency desynchronizing a snapshot — and a
pass that leaned on the cycle guard's provisional "assume fresh" answer is retired
when it ends, so a guess never reaches a later read. Cyclic cold graphs therefore
keep their previous behaviour: the cycle is still reported on every read and no
snapshot latches. The one residual difference is the numeric value a read of a
cyclic cold graph returns, which was already unspecified (it diverges on every
read and does not agree with the live path); a 220-program differential fuzz over
scopes, transactions, batching and subscription churn shows no divergence at all
on acyclic graphs.
