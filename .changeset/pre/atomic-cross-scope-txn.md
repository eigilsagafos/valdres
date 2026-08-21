---
"valdres": patch
---

Make `store.txn()` atomically observable across scopes. A single transaction
that writes to the root and to one or more scopes (via `t.scope(...)` /
`t.parentScope(...)`) is now committed as write-everything-then-notify-everything:
all values across the whole store tree are applied first, then a single
notification pass runs. Previously each store committed and propagated in
sequence, so a root subscriber, `onSet` hook, or a selector spanning root + scope
could observe a half-applied transaction (root = new while a scope was still old,
or scope A applied before scope B's writes landed). The final committed state was
always consistent — only the observation was non-atomic.

`atom.onSet` now fires in the notify phase (after all writes) for the cross-scope
path, so a hook reading any atom sees the fully-applied transaction; it still
fires before subscribers, preserving the prior relative ordering. The
single-store / non-scoped-txn fast path is unchanged in both behavior (onSet
fires inline during the write loop) and performance.

Two related fixes fall out of the coordinated commit:

- A direct subscription created in a scope before the scope shadows an atom is
  now correctly re-rooted when one transaction both writes that atom at the root
  and shadows it in the scope — the subscriber fires once (it previously fired
  twice), matching the non-transaction `set()` path.
- A selector reachable by more than one store's propagation pass in a single
  cross-scope commit (one spanning an ancestor atom and a scope atom, or an
  updated atom and a deleted family) is now evaluated exactly once per commit
  instead of once per reaching pass.
- Adding or deleting a family member at the root inside a transaction now
  cascades into scopes that already shadow that family (their dependent
  selectors and subscribers see the change). Previously the transaction cloned a
  new root family index and the shadowing scope kept pointing at the old one, so
  it never observed the add/delete — the non-transaction `del`/`set` path was
  already correct.
