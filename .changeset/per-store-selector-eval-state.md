---
"valdres": patch
---

Move selector evaluation state (`circularDepSet`, `latestEvalContext`) from
module-level to `StoreData`. Two fixes:

- The same selector evaluated across two stores no longer triggers a spurious
  `SelectorCircularDependencyError` when one store's evaluation
  synchronously asks another store for the same selector.
- Async selectors with deferred (post-await) `get` calls now correctly
  register dependencies even when the same selector is evaluated concurrently
  in another store. Previously the second store's eval would mark the first
  store's eval context `revoked`, causing the deferred `get` to fall into the
  read-only "stale closure" branch and silently drop dep registration.

Both sets allocate lazily on first access (same pattern as the other per-store
maps), so store creation overhead is unchanged.
