---
"valdres": minor
---

Add `scopedStore.unset(atom)` — drop a scope's own value for an atom so it
re-inherits its parent's current value. The natural inverse of `set`.

A scoped store shadows its parent on write (copy-on-write into the scope). Until
now there was no public way to drop that shadow: `reset` pins the scope to the
atom's default, and `del` removes a family member — neither re-inherits the
parent's *current* value. `unset` fills that gap (notably for dev-tools
time-travel, which needs to faithfully restore an override that was inherited at
the target point). The name follows the same scoped-fallthrough semantics as
`git config --unset` and shell `unset`.

- `scopedStore.unset(atom)` removes the scope's own value and all its bookkeeping
  (the shadow, the parent's `scopeValueIndex` entry, the scope's index keys, any
  `maxAge` write timestamp), then notifies the scope's subscribers, dependent
  selectors, and nested scopes of the now-inherited value. Subscriptions resume
  tracking parent changes again.
- No-op (no notification) when the scope holds no own value for the atom.
- Throws on a root store (no parent to inherit from) and for non-atoms.
- Surfaces on `store.onChange` as a `kind: "set"` change carrying the inherited
  value, tagged with the new `StoreChangeMeta.source` `"unset"` — so a consumer
  can tell the override was dropped without overloading the `"delete"` kind.
- Transaction form: `t.scope(id, st => st.unset(atom))` (and `txn.unset` on a
  scoped-store transaction), collapsed into the transaction's single `onChange`
  callback. Within a transaction, a later `set`/`reset` of the same atom
  supersedes a buffered `unset` (and vice versa), and a mid-transaction read of
  an unset atom returns the inherited value.
