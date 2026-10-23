# Committed collection change events

Status: implemented as a review candidate. The size-gate allowances, feature
budgets, certified runtime digest and contract pins it needs are proposed below
and not applied; they need owner approval.

## Problem

ShiftX keeps its mutations in a Valdres collection through `@roc-db/valdres`.
Its sync loop must capture new rows, debounced revisions and acknowledgements in
order, and process them outside notification, because processing writes sync
status and queue state. With v1, a direct `sub(collection)` observes membership
only and passes no arguments, so ShiftX keeps one subscription per mutation row
for the life of the session, scans membership to discover new rows,
reconstructs the order of additions and revisions, and keeps extra bookkeeping
to tell revisions from acknowledgements.

Old Valdres (`0.2.0-pre.28`) family subscriptions passed member keys, coalesced
repeated sets, delivered sets in first staged order and deletions in a separate
later phase, and supplied no event type or previous value. They were not a
write journal.

## API

```ts
const unsubscribe = store.sub(mutations, event => {
    switch (event.type) {
        case "added": // event.key, event.value
        case "updated": // event.key, event.previous, event.value
        case "deleted": // event.key, event.previous
        case "reordered":
    }
})
```

`CollectionEvent<Key, Value>` is exported from the root. Only the direct
callback form on a collection changes. The handler form
(`sub(collection, { settle, notify })`), selectors that read the collection,
queries, rows, `presence`, and the adapter `subscribe` seam (so `useValue`) keep
value (membership) semantics. There is no separate method, journal, transaction
id or replay.

## Semantics

- **Net effect.** Each key's committed effective value before the transaction is
  compared with its final value using `Object.is`, the equality row
  subscriptions use: absent to present is `added`, present to a different value
  is `updated` with both values, present to absent is `deleted`, and anything
  else produces no row event. At most one row event per key per transaction.
- **Order.** Row events follow the order of each row's first staged value or
  presence change in the subscribed scope or one of its ancestors: the first
  staged write after which the written scope's effective value differs (by
  `Object.is`) from before it. Ownership-only writes do not reserve a position:
  deleting an absent row (a root no-op or a child tombstone), an override equal
  to the inherited value, or a reset of an override equal to the inherited
  value. Later writes never move a row. All three row types share one order;
  there is no deletion phase. The kernel's staging `planOrder` (which also
  admits ownership-only writes and shapes `resetAll` staging) is unchanged; the
  draft keeps a separate `eventOrder`, filled only while an event subscriber
  exists.
- **Reorder.** At most one `reordered`, after the row events, when rows present
  before and after the transaction change relative order: a row deleted and set
  again in the transaction, or order restored by `resetAll`. Additions and
  deletions alone never produce it. It carries no order; consumers read
  `get(collection)`.
- **Bulk reset.** `resetAll` stages one reset per owned row; those rows take the
  position of that staging unless the transaction changed them earlier: the
  parent's current order, then rows the parent lacks in the order the scope
  acquired them. `resetAll` already staged in parent order when the scope had
  child scopes; it now also does so when the scope has a live event
  subscription, because the order became observable. Without either, staging
  order stays unobservable and skips the parent walk. (The child-scope test
  alone was not enough: `children` is weak, so a dropped anonymous child made
  the order depend on garbage collection.)
- **Scopes.** Events describe the subscribed Store's effective collection.
  Parent changes reach a child unless the child overrides the row; child writes
  never reach the parent. Across subscriptions, delivery follows the order the
  update reached them (the ordinary snapshot rule). Within one transaction and
  collection, ancestors' event subscribers come first; scopes at the same
  depth follow the order in which their current subscription began.
- **Transactions.** Each committed transaction is delivered separately, in commit
  order. Each `settle` commit is its own transaction and follows the commit that
  triggered it. A failed transaction (including a failed `settle` draft)
  delivers nothing; an applied one still delivers when notification later fails.

## Delivery

Events reach the subscriber in the ordinary notification snapshot, after
propagation and `settle` handlers, before `set`/`txn` returns. Each event is one
subscriber attempt: the registration's events are attempted in order, then the
next registration's. A throw is recorded in the boundary's
`SubscriberNotificationError` and the remaining events and subscribers are still
attempted; nothing is retried. An unsubscribe or disposal stops the
registration's remaining events. Events are frozen and shared by every
subscriber; values are passed by reference, not cloned or frozen.

## Implementation

- The collection kernel owns a per-StoreTree event channel per collection. The
  channel object is the host subscription key for direct callbacks, so event
  subscribers get their own `SubscriptionTarget` without a parallel registry or
  delivery engine.
- At plan time, before anything applies, the kernel computes each subscribed
  scope's events from the draft's `planOrder` (filtered to the scope's route)
  by comparing committed and final effective values, and detects reordering
  from the membership plan nodes it already computes. It does not subscribe to
  rows or scan memberships for value changes. With no event subscriber
  anywhere, the only added work per collection plan is one integer comparison.
- At settlement, the kernel reaches the event target with its events. A
  boundary with reached targets but no changed source still notifies, so an
  event-only commit delivers without counting the channel as a changed source
  (inspection `changedSources` is unchanged). The host appends events per
  boundary (in commit order across `settle` commits), and the snapshot expands
  each event registration into one attempt per event. Undelivered events are
  dropped when a boundary ends.
- Channels hold scopes through weak references, so an unsubscribed scope is
  collectable without a later write. Stale registrations are pruned on the
  tree's next plan for that collection, disposal releases them immediately, and
  resubscribing moves a scope to the end of the sibling order.

Cost: a value-only update with one event subscriber builds one frozen event per
changed row; a reorder check scans the subscribed scope's membership only when
a row left and returned in the transaction or an order was restored (both
already O(collection) paths). `resetAll` on a scope with its own event
subscriber walks the parent's membership once per affected collection, as it
already did for scopes with child scopes. The zero-subscriber fast path uses
one counter for the whole runtime domain; with any event subscriber, plans in
other Stores pay one extra WeakMap lookup.

## Measurements

Baseline: origin/main `b1370f2c`. Candidate: this change. Production builds,
pinned Bun 1.4.3 and Node 24.16.0, macOS arm64 under load. Interleaved
fresh-process A/B, median of per-process medians over 5 rounds (9–11 for the
lanes re-checked); the local noise floor is about ±5%.

Existing paths (candidate / baseline):

| Lane | Bun | Node |
| --- | --- | --- |
| atom set, no subscriber | 0.997 | 1.009 |
| atom set, one subscriber (9 rounds) | 1.020 | 0.985 |
| 10k rows, update one, no subscriber (9 rounds) | 1.000 | 1.026 |
| same, membership selector + row subscriber (9 rounds) | 1.028 | 1.002 |
| same, 10k row subscriptions (9 rounds) | 0.967 | 0.994 |
| add then delete one row (9 rounds) | 0.961 | 1.009 |
| 1,000-row update transaction | 1.008 | 1.006 |
| 500 adds + 500 deletes ×2, membership selector | 1.010 | 1.028 |
| depth-2 child reads, root update | 0.997 | 0.996 |
| resetAll + rebuild 100 rows | 0.989 | 0.972 |
| subscribe + unsubscribe, collection `{ notify }` | 1.018 | 1.014 |
| subscribe + unsubscribe, collection direct callback (final, 7 rounds) | 1.669 | 1.309 |

The direct-callback subscribe lane now registers the scope in the event channel
(about 50 ns per subscribe); it is the only existing-API lane outside the noise
floor. Lanes above were measured before the review fixes; after them, atom
notify was re-measured at 1.014 (Bun) and 0.979 (Node) over 7 rounds.

New observation cost (candidate only, ns per operation; compare with the
matching no-subscriber lane above):

| Lane | Bun | Node |
| --- | --- | --- |
| 10k rows, update one, no subscriber | 1,797 | 1,945 |
| same, one event subscriber | 2,505 | 2,244 |
| same, ten event subscribers | 3,428 | 2,606 |
| same, 10k per-row subscriptions (today's ShiftX approach) | 2,886 | 2,387 |
| depth-2 child event subscriber, root update | 2,477 | 2,311 |
| 1,000-row update transaction, no subscriber | 1,014,690 | 1,376,044 |
| same, one event subscriber | 1,198,677 | 1,389,617 |
| 500 adds + 500 deletes ×2, one event subscriber | 6,766,906 | 4,385,802 |
| resetAll + rebuild 100 rows, one event subscriber on the scope (final) | 1,042,621 | 687,876 |

One event subscriber is cheaper per update than 10,000 row subscriptions on
both engines. `resetAll` on a scope with its own event subscriber now walks the
10,000-row parent membership to stage in parent order (about +0.5 ms on Bun,
+0.2 ms on Node per transaction here), the walk a scope with child scopes
already does. Bulk cost is linear in changed rows (about 180 ns per event on
Bun, 15 ns on Node for the 1,000-row lane).

Retention (heap after forced GC, after event-loop turns): 100k
subscribe/commit/unsubscribe cycles, 25k child scopes subscribing, receiving a
commit and being disposed, and 10k commits of 10 KB payloads with an event
subscriber all stay flat across rounds on both engines, at the same level as
the baseline. 200 unnamed scopes that subscribe and unsubscribe with no later
write are all collected (the pre-review candidate retained all 200).

Sizes (final candidate, pinned Bun 1.4.3): core-retaining `atom-selector-store`
72,439 raw / 19,733 gzip (+372 / +142 over the current allowance; the host
routing, accumulation, per-event attempts, event-only boundary trigger and
boundary cleanup), `collection` 115,269 / 32,791 (+3,236 / +935), packed
tarball 553,721 / 149,465 (+7,484 / +2,603). The first-value-change ordering
fix left the core fixture unchanged; an A/B of the previous candidate against
the fix on the affected lanes (single updates, 1,000-row and add/delete
transactions, child reads, `resetAll`, with and without an event subscriber)
stayed within the noise floor on both engines.

## Proposed approvals (not applied)

One combined proposal, measured on the candidate; `PROPOSED-approvals.patch`
in the handoff applies it:

- `scripts/size-baseline.json`: `coreRetainingRawAllowance` 5783 → 6155 and
  `coreRetainingGzipAllowance` 2322 → 2464 (exact overage of
  `atom-selector-store` against its immutable 2% ceilings 66,284 / 17,269);
  feature budgets to measured values: dist 394,178 / 117,072, packed
  553,721 / 149,465, collection 115,269 / 32,791, query and query-development
  121,684 / 34,866, all-exports 147,844 / 42,211, inspect 110,298 / 29,959,
  external-atom 93,316 / 25,535; `certifiedRuntimeBuildSha256`
  `92653ac8afbe88a189218cb308a26de3d83ae6db174b1abfdd6624a0b82ae6df`.
  `scripts/toolchain-version.test.ts` pins the two allowances. Immutable
  ordinary baselines are unchanged.
- Contracts: catalogue `core.type.collection-event` (public API entry and
  frozen coordinate) and contract ID `collection.committed-events` (also on
  `core.store.sub`); pins `frozenTargetCoordinateInventorySha256`
  `5c908b04e7302e7635fcb6d4f7a6c23f1aafddbdab15f9e5bf4640ee777e104f` and
  `frozenReleaseTrackOwnershipSha256`
  `0e30f9632fedf4a738904b678debe0667f608169a25f376845504af9e67d6e8b`.

With the proposal applied in a scratch tree, `bun run verify` and
`test:v1-beta:packed` pass.
