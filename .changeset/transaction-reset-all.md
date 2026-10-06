---
"valdres": minor
---

**Experimental: `Transaction.resetAll()` resets everything a child scope owns in
one transaction, restoring its parent's values and collection order.**

`tx.scope(child).resetAll()` stages a reset of every atom, family member and
collection row the scope owns, including writes staged earlier in the same
transaction. The scope then reads as an untouched child of its parent. Its
handle, subscriptions and descendant scopes remain, so a draft can be cleared
and rebuilt in place and subscribers see one change.

- Child-scope cursors only. There is no Store-level form. A root cursor or any
  argument throws `TypeError` and stages nothing.
- All or nothing: every atom is resolved before anything is staged, so a failing
  lazy initializer throws and stages nothing. An error escaping the callback
  discards the reset with the rest of the transaction. Failures after the commit
  applied, such as a `SubscriberNotificationError` (`committed: true`), do not
  undo it.
- Values, equality and notification are those of `reset`. An otherwise untouched
  scope aligned with its parent publishes nothing; a scope with no row overrides
  can still have its own order from earlier writes, and restoring it publishes
  membership and query changes. An empty reset may still do transaction
  bookkeeping.
- In every collection, whether or not the scope owned rows there, membership
  follows the parent's order, then rows that became present later in the
  transaction; later writes to the scope order as in an untouched child. A
  descendant that mirrored the scope, writes no rows there and whose own rows
  agree keeps mirroring it. Other descendants keep their own order. Single-row
  `reset` is unchanged.
- `valdres/inspect` reports the bulk reset with the existing per-state reset
  details. A restored membership now also reports the rows it gains or loses as
  `collection-membership` insert/remove details.
- No linear complexity or latency bound is promised. A cold draft membership
  read below nested reset or mirroring scopes can do comparison work on the
  order of collection size times depth squared, plus ownership scans and other
  bookkeeping; warm memoized reads skip that search until an affecting write
  invalidates them. Ordinary child-scope transactions gain conditional
  ordering-history bookkeeping, and plain Stores run an inspection check on
  restored memberships without allocating inspection details.
