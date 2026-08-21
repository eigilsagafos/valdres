---
"valdres": minor
---

Add `store.snapshot()` — enumerate a store's current materialized state, for a
dev-tools consumer that connects after state already exists. Where
`store.onChange` reports changes going forward, `snapshot()` lists what's there
now: every set atom, every default-valued atom that's been read, every live
(evaluated) selector, and every family member — across the root and all nested
scopes.

It's **opt-in at store creation**:

```ts
const s = store(id, { enumerable: true })
// or store({ enumerable: true })
s.snapshot() // SnapshotEntry[]
```

Each entry is `{ type: "atom" | "selector", state, value, scope }`, reusing
`onChange`'s exact shape and filtering: internal (`__valdresInternal`) states
(e.g. the cacheMeta atom) and family container objects are excluded, atoms vs
selectors are classified via `isSelector`, and `scope` is the same id path from
the outermost scope down (`[]` for the root).

As part of this, the cacheMeta selector (the public counterpart to the internal
maxAge/stale-while-revalidate cacheMeta atom) is now flagged `__valdresInternal`,
so a *live* cacheMeta selector is excluded from both `store.snapshot()` and
`store.onChange({ selectors: true })` — matching the already-excluded cacheMeta
atom.

A store's values normally live in a `WeakMap`, so unreferenced atoms/selectors
are garbage-collected and can't be enumerated retroactively. `{ enumerable: true }`
switches that one structure to a `Map` (propagated to every nested scope), which
retains entries for the store's lifetime — the deliberate cost of enumerability,
fine for the dev/inspection context it's meant for. The mode is chosen once at
creation, so the `get`/`set` hot paths are byte-identical to a default store and
the default (WeakMap, GC-friendly) behavior is unchanged. Calling `snapshot()` on
a default store returns `[]` and warns once.
