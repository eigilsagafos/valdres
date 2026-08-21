---
"valdres": patch
---

A direct write to a global atom now builds six plan objects per commit instead
of nine: the ordered global sets and the deferred onSet queue share one
`[atom, value, origin]` descriptor and one queue rather than allocating a
duplicate pair, since they describe the same write.

`store.onCommitEnd` no longer fires for a commit that produced nothing. A
transaction whose every write is value-equal, and a `reset` of an atom already
holding its default, are now as silent as the no-op `set` and no-op `unset`
already were. Real work performed inside such a commit — a subscriber or `onSet`
hook writing during delivery — still coalesces into exactly one notification.

Internally, the illegal `CommitPlan` states are now unrepresentable rather than
merely unused: `beginCommit`/`endCommit` are one paired boundary capability,
global fan-out exists only as part of a forest settlement, report preparation
requires the report it prepares, and delete/unset work groups are non-empty or
absent — which also removes an asymmetry where an empty `deleted` group counted
as settlement work while an empty `unsetAtoms` group did not. Settlement work is
evaluated once per commit instead of three times. The published bundle is
unaffected by the accompanying engine self-checks: they are compiled out.
