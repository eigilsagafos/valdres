---
"valdres": patch
---

Fix spurious `SelectorCircularDependencyError` for selectors with no real
cycle. `evaluateSelector` now runs its cleanup in a `finally` so the
module-level `sharedCircularDepSet` is always cleared on exit — including
when an inner selector throws a non-cycle error and the outer's `catch`
re-raises a `SelectorEvaluationError`. Previously the entry leaked, and the
next read of the outer selector tripped the cycle check on a stale entry.
