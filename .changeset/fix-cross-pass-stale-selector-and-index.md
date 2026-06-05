---
"valdres": patch
---

Fix stale cross-scope/cross-pass selectors and a related `index()` crash
(regressions exposed by the beta.4 topological propagation and the beta.5
cross-scope atomic commit).

**Stale selector across commit passes + non-atomic observation.** A cross-scope
transaction (and the single-store update+delete transaction) propagates in one
pass per store and shared a per-commit `evaluatedSelectors` dedup guard so a
selector reachable by more than one pass evaluated once. That guard caused two
correctness regressions — a selector (and its whole subtree) left stale, e.g. a
node dragged and dropped back outside any dropzone settling one row too low, or
a connector line rendering stale geometry:

- Keyed by selector *object*, it skipped a scope's copy of a selector that was
  also live in the root (the same object has a different value per store).
- It locked in a value an early pass computed from an intermediate *selector*
  that a later pass corrected (e.g. a scope selector reached via a root atom
  before its sibling scope selector settled).

The dedup guard is **removed**. Multi-pass commits now (1) write every value
across every store first, (2) let each store re-derive its own selectors against
that final state — a selector reachable by two passes is simply recomputed in
each, and the equality check prunes the redundant result — and (3) **defer all
subscriber notification to the end of the commit**, firing each subscriber once.
This makes a transaction *serializable to observe*: no subscriber, and nothing a
subscriber reads, ever sees a half-applied intermediate. A selector reachable by
multiple passes now has its body run once per reaching pass (the dropped
optimization); the single-store / non-scoped hot path is untouched.

**`index()` crash / desync across stores.** `index()` kept a mutable Set + Map
of current members in closure scope and mutated them from inside a selector
evaluation. Because selectors evaluate independently per store, reading the same
index in both a root and a scope with divergent family membership (e.g. publish
moving members between a scope and the root) clobbered the shared state, and the
filtered selector could iterate a member whose predicate-selector entry had been
deleted by the other store's evaluation — throwing
`Cannot convert undefined or null to object`. `index()` now derives membership
from `get(family)` on every evaluation (correct per store) and caches per-atom
predicate selectors in a grow-only, store-agnostic map (a lookup is never
undefined).

`isAtom` and `isGlobalAtom` also gained the `state && …` null-guard the other
`is*` helpers already have, so a stale read degrades gracefully instead of
crashing in `Object.hasOwn(undefined, …)`.
