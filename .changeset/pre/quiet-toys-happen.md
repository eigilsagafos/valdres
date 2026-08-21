---
"valdres": minor
---

Add `ScopedStore.unsetAll()` — drop every value a scope owns so it reverts
wholesale to what it inherits, without destroying the scope.

`unset(atom)` already drops one shadowed value so the atom re-inherits its
parent's and resumes tracking it. `unsetAll()` is that for the whole scope, in a
single commit:

```ts
const draft = root.scope("draft")
draft.set(title, "Draft title")
draft.set(entity("draft-only"), "only in the draft")

draft.unsetAll()

draft.get(title) // the root's title again — and tracking it
draft.get(entity) // the root's members again
```

Atom-family membership reverts in both directions: members the scope added leave
its `get(family)`, and members it deleted with `del()` come back. Every atom the
scope shadowed notifies, exactly as `unset` does — including one whose inherited
value is equal, since the scope genuinely stopped owning it. Atoms it never
shadowed are untouched.

The scope itself survives: id, leases, subscriptions, and nested scopes all keep
working, and it shadows again on the next write. That is the difference from
`detach()`, which releases a lease and destroys the scope with the last one — so
this is the operation for a scope whose edits have been applied or abandoned
while the scope stays on screen. Reverting also releases the atoms a long-lived
scope would otherwise pin for the store's lifetime.

Inside a transaction it stages rather than commits, so a scope can be reverted
atomically with the writes that supersede it — from the scope's own transaction,
or from the parent's:

```ts
draft.txn(txn => txn.unsetAll())

root.txn(txn => {
    txn.set(published, draftContent)
    txn.scope("draft", scoped => scoped.unsetAll())
})
```

`unsetAll()` is a scope operation — a root store has no parent to revert to —
and the types say so: it is on `ScopedStore`, not `Store`, and on the new
`ScopedTransaction` that `txn.scope()` hands its callback, not on the root
`Transaction`. Calling it on a root store or root transaction throws.

Three types are new or newly exported, all additive:

- `BorrowedScopedStore` — the store the callback form of `scope()` hands out
  (previously the anonymous `Omit<Store, "dispose">`). Reaching `unsetAll()`
  through it takes no lease: `root.scope(id, scope => scope.unsetAll())`.
- `ScopedTransaction` — a `Transaction` plus `unsetAll`, received by
  `txn.scope()` callbacks and by `ScopedStore.txn()`.
- `ScopedTransactionFn` — a callback taking a `ScopedTransaction`.

None of this is a breaking change: callback parameters are contravariant and
both new store/transaction shapes are subtypes of the old ones, so every
existing `(store: Omit<Store, "dispose">) => ...` and `(txn: Transaction) => ...`
callback still assigns.
