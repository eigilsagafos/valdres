# Collection foundation test plan

## Semantic oracle

- Before using the oracle, repair and pin three defects:
    - unmaterialized equal/non-equal child Present shadows retain membership and
      original position after a parent delete; and
    - `set(A) -> set(B) -> update(A)` plus child reset/local-shadow variants
      retain A's continuous absent-to-present enabling sequence and order
      `[A, B]`; and
    - native row/membership notifications follow target first-reaching order,
      not global subscription-registration order, with the exact first thrown
      error as `cause` and every thrown error, including the first, in ordered
      `causes`.
- Do not compare presence notification order as a direct model target.
  `presence(row)` is an ordinary Selector; dedicated runtime tests own its
  dependency-first callback/error order.
- Port the expanded deterministic collection suite to a public-runtime candidate
  driver.
- Add seeded deterministic traces over define-row/read/set/update/delete/reset,
  root/child/sibling cursors, transaction abort/caught errors, and disposal.
- Compare values, presence, ordered row handles, reference stability,
  notifications, commit status, and effective delta summaries.
- Notification order is authoritative only for root-local native
  Atom/row/collection targets. Normalize cross-scope route order and presence
  callbacks out of model differentials; exact runtime tests own both because the
  pure model has no route-materialization graph or Selector evaluator.

## Focused matrices

| Area           | Required cases                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Key identity   | scalar type separation, `-0`, invalid number/object/symbol/undefined, encoded collision, throw/thenable/capability, weak repair/finalizer |
| Row operations | absent get, set upsert, present update, absent update, delete, reset, undefined/thenable, function value, `Object.is`/NaN/`-0`→`0`        |
| Scopes         | inherited present, equal shadow, tombstone while parent absent/present, reset reconnect, coordinate-local arrays, final overlay order     |
| Transactions   | mixed atoms/rows, staged reads, scratch selectors, membership identity across atom writes, effective enabling birth, abort, closed cursor |
| Reactivity     | row/presence/membership/selector subscriptions, no-op/value/routing changes, Atom→row→membership callback order and error aggregation     |
| Lifecycle      | lookup/read weakness, present/membership pins, child-delete tombstone pin, root-delete/reset/dispose release, named/anonymous, two Stores |
| Inspection     | fixed counters, op/commit/span links, detail overflow, JSON safety, no key/value/error retention                                          |
| Packaging      | exact root exports/types, split graph, atom-only reachability, installed tarball, React 18/19, SSR/hydration                              |

Every transaction exit path—success, callback abort, preflight failure, and
committed-error exit—must run the optional kernel `releaseDraft` hook. Retain a
closed cursor deliberately and prove no staged row value, intent, enabling
history, or membership memo remains reachable.

Within one target, callbacks follow subscription-registration order and
duplicate target subscriptions fire independently. Freeze both error ledgers:
subscriber-only `cause === first` with `causes` containing every throw including
the first, and mixed post-apply mismatch plus subscriber failures with
`cause === mismatch` and `causes === [mismatch, ...subscriberThrows]`.

Exact delivery-order matrix:

- reverse subscription registration relative to A-then-B source staging;
- parent/descendant and sibling routes materialized in an order different from
  scope creation, proving parent-first DFS then route-insertion order;
- overwritten A→B→A coordinates retaining A's first final-plan slot;
- two collections proving cross-collection first-encounter interleave; and
- overlapping parent/child intents proving first-discovery deduplication.

## Performance gates

- Pair ordinary atom/core-load/rewire controls against the exact base artifact.
- Measure collection lookup hit/miss and encoded hit in fresh processes.
- Measure absent read, value update, insert, delete, and transaction membership
  reads at 1k/5k/20k rows.
- Assert `Object.is`-distinct present-to-present update counters are independent
  of membership cardinality; same-value/NaN writes are full effective no-ops.
- Assert every affected MembershipRecord is rebuilt at most once per commit.
- Assert lookup/read of absent rows creates no Store membership or owner pin.
- Assert atom-only imports/domains/Stores allocate no collection registry,
  cache, scope sidecar, or workset.
- After a collection installs the domain vtable, run Atom-only work in a fresh
  Store/transaction and assert zero collection draft/scope allocations, zero
  collection counters, and <=10% ordinary timing delta.
- Preserve pre-collection `atom` and `atom-selector-store` baselines under the
  existing <=2% gate and ordinary timing under <=10%; add a distinct reviewed
  feature budget for collection/dist/packed/all-exports rather than ratcheting
  away the controls.

## ShiftX acceptance

- Two session rows, fixed clock, one valid and one expired.
- Draft derived filtering selectors see staged membership.
- Value update keeps exact membership reference.
- The adapter preattaches each row subscription before its first local/hydration
  set; insert then synchronous update before any microtask persists correctly.
- Delete then synchronously reinsert before queued teardown; generation-checked
  stale cleanup must not unsubscribe or delete persistence for the live row.
- Shuffle persisted row envelopes, sort by their monotonic birth order, and
  hydrate; exact membership and first-match derived-selector results survive
  restart without a parallel refs array.
- Seed the next-order allocator from `max(restoredOrder, watermark) + 1`;
  hydrate the post-reinsert `[B, A]`, insert C, restart shuffled, and retain
  `[B, A, C]`. Delete/reinsert gets a fresh order; duplicate/non-finite orders
  reject before Store writes.
- Upgrade legacy plain entries by first atomically writing one complete staging
  manifest of identity/order assignments, then resumably writing envelopes and
  using a durable marker as the visibility switch. Fault-inject after every
  write; interruption, retry, and a second restart expose neither half-migrated
  membership nor a different order.
- An aborted third row handle may exist inertly, but the row stays effectively
  absent and membership/storage/notifications remain unchanged; post-transaction
  reconciliation disposes its provisional row subscription.
- Logout deletion removes membership and storage; reinsertion appends.
- Fresh-store hydration needs no parallel refs array.
- Structural report is complete and contains no row values or keys.

## Contract and packaging gates

- Preserve `State.kind` narrowing while adding readonly collection source arms;
  keep family factory admission Atom-or-Selector only.
- Reject at compile time a `Value` generic containing `undefined`,
  `set(row, undefined)`, an undefined updater result, `delete(atom)`, and
  mutation of readonly row/collection sources. Function values use `set`, never
  updater dispatch. Reject foreign-domain handles at runtime with exact
  `RuntimeMismatchError` identity.
- Declaration-emit installed-consumer fixtures export direct and rich-input
  collection bindings so an unnameable inferred private type cannot escape.
- Reconcile materialization priority to exactly `"user-visible" | "background"`
  in the contract type spike even though materialization runtime stays deferred.
- Keep `CollectionOptions.indexes` closed as `indexes?: never`; accept no index
  descriptor or ignored option in this beta.
