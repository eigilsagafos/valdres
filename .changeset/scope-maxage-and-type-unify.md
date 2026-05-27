---
"valdres": patch
---

Unify `RootStoreData` and `ScopedStoreData` into a single `StoreData` shape
with an optional `parent`. Structural `"parent" in data` branches collapse
to `data.parent` checks, dropping three `@ts-ignore @ts-todo` markers from
`getState.ts` and `transaction.ts`.

Fix two surprises around `maxAge` × scope shadows:

- `scope.set(maxAgeAtom, value)` is now a deliberate pin. The lazy
  revalidation guard in `isCachedValueStale` no longer evicts scope-local
  values past their TTL, so the shadow survives an unsubscribed read
  instead of silently falling back to the parent.
- Subscribing to a scope-shadowed `maxAge` atom no longer installs a
  second, scope-local revalidation timer that would overwrite the shadow
  and double-invoke `defaultValue()`. Non-shadowed scope subscriptions
  continue to delegate up to the parent's timer as before.
