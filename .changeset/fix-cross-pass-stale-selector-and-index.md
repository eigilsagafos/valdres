---
"valdres": patch
---

Fix stale cross-scope/cross-pass selectors and a related `index()` crash
(regressions exposed by the beta.4 topological propagation and the beta.5
cross-scope atomic commit).

**Stale selector across commit passes.** A cross-scope transaction (and the
single-store update+delete transaction) propagates in one pass per store and
shares a per-commit `evaluatedSelectors` guard so a selector reachable by more
than one pass evaluates once. Two flaws made selectors (and their whole
subtrees) go stale — e.g. a node dragged and dropped back outside any dropzone
settling one row too low, or a connector line rendering stale geometry:

- The guard was keyed by selector *object*, but the same selector has an
  independent value in the root and in each scope. A selector subscribed in both
  the root and a scope was evaluated in the root pass, marked done, and the
  scope's (differently valued) copy was skipped entirely — left stale. The guard
  is now keyed **per store**, so each store evaluates its own copy while the
  intra-store dedup is preserved.
- Even within one store, the guard assumed the first reaching pass computed the
  final value — true for atom-only selectors (all writes precede propagation),
  but false when a selector depends on an intermediate *selector* recomputed in
  a later pass (e.g. a scope selector reached via a root atom before its sibling
  scope selector settles). A guarded selector is now recomputed when one of its
  dependencies actually changed value later in the commit (tracked by the topo
  `needsEval` set); the redundant pass is still skipped when nothing it depends
  on moved, so the "evaluate once" fast path is unchanged for atom-only
  selectors and the single-store / non-scoped hot path is untouched.

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
