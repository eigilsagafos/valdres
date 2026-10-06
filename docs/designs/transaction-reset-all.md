# Transaction.resetAll

Status: approved by the owner on 2026-10-06 as an experimental
transaction-cursor API, with the semantics, review record, contract pins and
size certification below.

## Problem

An application draft store rebuilds an existing draft scope in place: it writes
the root's version, clears everything the draft owns, seeds a historical
snapshot and replays the draft's mutations, all in one transaction. Disposing
and recreating the scope would drop every subscription and handle. Resetting
each owned state one at a time with `reset` loses the parent's collection order,
because each revealed row is a new placement, and the caller has to enumerate
ownership it cannot see. Beta `unsetAll` was removed in v1 (`legacy.unset-all`)
without a replacement.

## API

`tx.scope(child).resetAll(): void` exists only on transaction cursors. It takes
no arguments; on the root cursor, or with an argument, it throws `TypeError` and
stages nothing. There is no `Store.resetAll` and no alias for the working name
`resetOwned` under which the operation was reviewed.

## Semantics

- It stages a reset of every Atom, family member and collection row the scope
  owns in its draft view, including writes staged earlier in the transaction.
  Every Atom reset is resolved before any is staged.
- Values, equality and notification are those of `reset`. A descendant that
  inherits a reset Atom is notified once if its value changes. A descendant's
  own override is kept and not notified.
- In every collection, whether or not the scope owned rows there, an explicitly
  reset scope reads as an untouched child of its parent: the parent's order,
  then rows enabled later in the transaction, in intent order. Its later writes
  order as they would in that child, independent of the order of resets and of
  which memberships were read.
- An uncleared descendant follows the restored order only if it mirrored the
  scope before the transaction, stages no row change of its own in that
  collection, and its own rows agree. Otherwise it keeps its own order history.
  Rows the reset reveals there are staged in the parent's current order.
- Nested reset scopes take their base order from the nearest ancestor that is
  neither reset nor mirroring. Draft reads, committed reads and indexed query
  ranks agree.
- An otherwise untouched, parent-aligned scope serves unchanged results and
  publishes nothing. A scope with no row overrides can still have local ordering
  history, and restoring that order publishes membership and query changes. An
  empty reset may still do transaction bookkeeping.
- `valdres/inspect` reports the per-state reset details. A restored membership
  also reports the rows it gains or loses as `collection-membership`
  insert/remove details. A pure reorder is visible only as the membership
  publication; no new inspection schema was added.

The reset is part of one atomic draft. An error escaping the callback discards
it. Failures after apply, such as a `SubscriberNotificationError`
(`committed: true`), an escaped selector error surfacing during propagation or a
`RuntimeMismatchError`, leave it applied. Not every error other than a
`SubscriberNotificationError` means rollback.

## Review record

- An independent review of the prototype reproduced four blockers (B1 index
  ranks after discarded births, B2 nested resets through a mirroring middle, B3
  stale cached query on an order-only reset, B4 a presence-neutral child write
  flipping mirroring). All four were fixed, and an independent re-review closed
  them.
- Integration found that an explicit reset of a never-owning scope below a
  restored ancestor did not restore its order (L4), plus two related gaps:
  delete-then-reset residue within one transaction, and a read-dependent commit
  for unmaterialized uncleared writers. A second independent review closed them
  and accepted the inspection change (L3).
- Maintained coverage: the reference model (`V1M-RESETALL-001`–`007`), a seeded
  runtime-versus-model differential (`V1M-RESETALL-008`: mixed, sparse and
  read-everything profiles), explicit-clear, B1–B4 and order regressions, the
  reviewers' probe scripts (adapted only by the method name), deterministic
  depth/work counters, and inspection tests.
- Application validation: the application's real adapter confirmed that the
  operation solves in-place rebase. It deliberately shows live-root entities
  that are absent from its historical snapshot. Fresh-object notification churn
  and lookup reconstruction remain application concerns.

## Cost

No linear complexity or latency bound is promised.

- A cold draft membership read below nested reset or mirroring scopes can do
  comparison work on the order of collection size times depth squared, in
  addition to ownership scans and other bookkeeping. Warm memoized reads skip
  that search until an affecting write invalidates them.
- Ordinary child-scope transactions gain conditional ordering-history
  bookkeeping.
- Plain Stores may run an inspection guard on restored memberships without
  allocating inspection details.

## Contract pins

`core.transaction.reset-all` (experimental), contract IDs
`scope.reset-all-untouched-child` and `collection.reset-all-descendant-order`.
The frozen target-coordinate inventory digest moves to `6b27a4c7…083e` and the
release-track ownership digest to `6f3eae46…564f`.

## Size certification

Approved by the owner on 2026-10-06. Measured on pinned Bun 1.4.0 against `main`
(`d2632c2e`), which sits exactly at the core-retaining ceilings:

| Fixture or budget                      | main raw / gzip   | branch raw / gzip | Change           |
| -------------------------------------- | ----------------- | ----------------- | ---------------- |
| `atom-selector-store` (core-retaining) | 68,912 / 18,612   | 70,472 / 19,039   | +1,560 / +427    |
| `dist`                                 | 369,992 / 109,366 | 385,200 / 113,906 | +15,208 / +4,540 |
| `packed`                               | 523,149 / 139,500 | 541,062 / 144,941 | +17,913 / +5,441 |
| `collection`                           | 102,849 / 29,031  | 110,423 / 31,278  | +7,574 / +2,247  |
| `query`, `query-development`           | 109,247 / 31,039  | 116,836 / 33,336  | +7,589 / +2,297  |
| `all-exports`                          | 128,040 / 36,341  | 135,636 / 38,643  | +7,596 / +2,302  |
| `inspect`                              | 106,724 / 28,743  | 108,332 / 29,224  | +1,608 / +481    |
| `external-atom`                        | 89,789 / 24,394   | 91,349 / 24,839   | +1,560 / +445    |

The core-retaining allowances move to 4,188 raw and 1,770 gzip, the exact
no-cushion overages. The feature budgets move to the measured values, and the
runtime digest is recertified as `94b04899…87d1`. The immutable ordinary
baselines are unchanged.
