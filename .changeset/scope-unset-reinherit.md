---
"valdres": minor
---

Add `store.unset(atom)` — drop a store's own value for an atom so it reverts to
what it would otherwise read. The natural inverse of `set` (cf. `git config
--unset`).

- On a **scoped store**, the atom re-inherits its parent's current value.
- On a **root store**, the atom reverts to its default; the stored value is
  removed (de-materialized) and re-initialized lazily on the next read — unlike
  `reset`, which eagerly writes the default back in.

Previously there was no public way to do either: `reset` eagerly pins to the
atom's default, and `del` removes a family member. `unset` fills the gap
(notably for dev-tools time-travel, which needs to faithfully restore an
override that was inherited at the target point).

- `store.unset(atom)` removes the store's own value and all its bookkeeping (the
  value, any `maxAge` write timestamp, and on a scope the parent's
  `scopeValueIndex` entry + the scope's index keys), then notifies subscribers,
  dependent selectors, and nested scopes of the reverted value. Scope
  subscriptions resume tracking parent changes again.
- No-op (no notification) when the store holds no own value for the atom.
- Throws for non-atoms.
- Surfaces on `store.onChange` as a `kind: "set"` change carrying the reverted
  value, tagged with the new `StoreChangeMeta.source` `"unset"` — so a consumer
  can tell the value was dropped without overloading the `"delete"` kind.
- Transaction form: `txn.unset(atom)` (and `t.scope(id, st => st.unset(atom))`),
  collapsed into the transaction's single `onChange` callback. Within a
  transaction, a later `set`/`reset` of the same atom supersedes a buffered
  `unset` (and vice versa), and a mid-transaction read of an unset atom returns
  the reverted value (inherited on a scope, the default on a root).
