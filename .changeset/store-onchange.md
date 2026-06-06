---
"valdres": minor
---

Add `store.onChange(callback)` — subscribe to every atom change in a store and
its descendant scopes. Intended for dev tools and debugging.

Emission happens at the propagation choke point (`propagateAtomUpdate` /
`propagateDeletedAtoms`), so `onChange` mirrors what a subscriber would see —
including changes that don't go through `set`/`txn`, such as **maxAge
stale-while-revalidate refreshes** and **async default resolutions**.

The callback receives `(changes, meta)`:

- `changes` — an array of `StoreChange`, a discriminated union on `kind`:
  `{ kind: "set", atom, value, scope }` for a value change, or
  `{ kind: "delete", atom, scope }` for a family-atom deletion (`store.del` /
  `txn.del`) — a deletion carries no `value`. A direct `set`/`reset` (or an async
  atom resolving) delivers a one-element array; a transaction delivers a single
  callback with all of its changes.
- `scope` — the chain of scope ids from the outermost scope down to where the
  change occurred (the ids you'd pass to `.scope()` to reach it), empty (`[]`)
  for a root store. Unambiguous for nested scopes that share a leaf name. A
  cross-scope transaction delivers one callback whose changes are individually
  scope-tagged.
- `meta` — `{ source, name? }`. `source` is what produced the batch:
  `"set" | "reset" | "delete" | "transaction" | "revalidate" | "async-set"`.
  `store.txn(callback, name)` accepts an optional name, surfaced as `meta.name`
  alongside `source: "transaction"`.

Internal valdres atoms (the cacheMeta atom backing maxAge/stale-while-revalidate)
are excluded so dev tools aren't flooded with implementation-detail churn.

Setting a **global atom inside a transaction** yields one callback per affected
store: the origin store gets a single `"transaction"` callback, and each watched
peer store gets a separate `"set"` callback (cross-store sync is a plain set on
each peer, not part of the origin's transaction). The peer callbacks fire first,
during the commit, before the origin's transaction callback.

`onChange` returns an unsubscribe function. A global listener count gates every
emit site, so when nothing anywhere is watching the propagation hot path does a
single property read — no walk, no allocation.
