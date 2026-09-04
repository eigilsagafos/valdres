# Collection foundation test plan

## Semantic oracle

- Before using the oracle, repair and pin four defects:
    - unmaterialized equal/non-equal child Present shadows retain membership and
      original position after a parent delete; and
    - `set(A) -> set(B) -> update(A)` plus child reset/local-shadow variants
      retain A's continuous absent-to-present enabling sequence and order
      `[A, B]`; and
    - native row/membership notifications follow target first-reaching order,
      not global subscription-registration order, with the exact first thrown
      error as `cause` and every thrown error, including the first, in ordered
      `causes`; and
    - a committed-present row that crosses a true same-draft absence gap is a
      fresh birth, while child shadows keep their baseline slot and a draft memo
      returning to the committed order reuses the committed array.
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
committed-error exit—must run the collection cleanup registered through
`TreeDraft.installRows`. In the draft-only slice, read-only lanes cover
success/committed errors while staged row lanes cover callback abort and
fail-before-mutation preflight. The scope slice adds successful and
post-apply-error exits with staged rows. Retain a closed cursor deliberately and
prove no staged row value, intent, enabling history, or membership memo remains
reachable.

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

T7 inspection/differential matrix:

- freeze collection counter codes `35..48` and structural detail codes `64..76`;
  every retained summary exposes all fourteen flat collection totals;
- run the same collection work with detail capacities `0`, `1`, and default,
  proving equal totals while only detail retention/overflow changes;
- wrap read-time row and membership materialization in `inspect.span` when
  asserting materialization totals; outside a span, assert only bounded details;
- capture same-domain rows and collections without reading or retaining row
  keys, values, inputs, updaters, callbacks, or errors; reject fake/foreign
  handles through the ordinary ownership boundary;
- record direct `Store.delete` as operation `delete`; retain transaction delete
  under one transaction operation;
- interpret one production-import-free deterministic scenario corpus against
  both the model and one public inspectable Store; compare normalized results,
  reads, commit status, structural deltas, notifications, ordered rows, frozen
  arrays, and membership identity equivalence rather than raw snapshot IDs;
- project model deltas to sources materialized before the corresponding commit.
  Ingest no-commit materialization details before comparing that command, but
  admit phase-0, rewire, and subscriber materializations only for later
  commands. Distinguish ownership-installed membership paths from still-cold
  RowViews. Compare membership publications only for model audit entries whose
  ordered membership source changed, not record-localization-only work. Never
  exhaustively read scopes to manufacture evidence; keep case 010's child
  RowView cold and use named pre-materialization only in focused cross-scope
  delta cases;
- compare root-local native Atom/row/collection notification order exactly,
  compare cross-scope and presence callbacks as counted multisets in the
  differential, and separately pin exact presence Selector dependency-first
  delivery and error identity;
- generate complete programs before execution with a versioned deterministic
  PRNG, fixed published seeds, bounded legal state, and failure output
  containing seed, step, mismatch path, command prefix, and lossless
  special-number tokens.

## Performance gates

- Keep ordinary atom/core-load counters and immutable package-size controls.
- Assert direct and encoded lookup identity at 1k/5k/20k rows.
- For value updates, inserts, deletes, and transaction membership reads at
  1k/5k/20k rows, pin exact route visits, scans, allocations, source
  publications, and effective-delta work rather than host timing slopes. Keep
  absent-read zero work and 20k sparse-sibling routing as dedicated cases.
- Inspection detail classification must reuse the existing placement pass.
  Phase-0 detail emission may iterate the aliased touched-placement map, but
  must add no second membership snapshot diff, Set, or collection-sized buffer;
  one insert or delete must attempt exactly three details regardless of tested
  cardinality.
- Assert `Object.is`-distinct present-to-present update counters are independent
  of membership cardinality; same-value/NaN writes are full effective no-ops.
- Assert every affected MembershipRecord is rebuilt at most once per commit.
- At 1,024 materialized membership levels, a root insert/delete creates one
  draft coordinate plus one lightweight placement state per level and stays
  linear; a one-leaf change below 20k materialized siblings visits no unrelated
  sibling routes.
- Assert lookup/read of absent rows creates no Store membership or owner pin.
- Assert atom-only imports/domains/Stores allocate no collection registry,
  cache, scope sidecar, or workset.
- After a collection installs the domain vtable, run Atom-only work in a fresh
  Store/transaction and assert zero collection draft/scope allocations, zero
  collection counters, and empty rebuild/placement traces.
- Run the residual constant-factor check as an explicit standalone Bun smoke,
  outside `bun:test`: one process, separate control/installed domains, fixed 40k
  direct and 20k transaction batches, four warmups, and eight adjacent AB/BA
  rounds. Record `Bun.nanoseconds` wall timing plus `process.cpuUsage`
  diagnostics. The geometric-median wall ratio targets <=1.10 as advisory and
  fails only at >=1.50; persist policy and commands, not machine samples. Run
  those manifest commands from `packages/valdres`.
- Keep every pre-collection baseline immutable. Name the provisional COL-004
  native-collection core gzip seam waiver: exactly 71 gzip bytes beyond the
  existing 2% ceilings on affected ordinary fixtures, with no raw allowance;
  graph/no-call/no-allocation and deterministic counter/trace gates remain
  unchanged.
- COL-008 certifies three byte-identical pinned Bun 1.4.0 builds and replaces
  the provisional value with the exact 62-byte maximum additive gzip allowance,
  with no cushion or baseline ratchet. Any later increase requires explicit
  architecture review. Keep distinct reviewed feature budgets for
  collection/dist/packed/all-exports/inspect; after COL-007, `inspect` is a
  feature fixture rather than an ordinary control. Both production and
  development runtime graphs remain part of the certified artifact.

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
- In the test-local historical adapter, logout deletion removes membership and
  storage and reinsertion appends. Current ShiftX must still confirm that true
  deletion is the intended real-app behavior.
- Fresh-store hydration needs no parallel refs array.
- Structural report is complete and contains no row values or keys.

## ShiftX selector prefix-proof follow-up

- The selector correction landed independently through #364; these bullets
  preserve its acceptance boundary and the remaining real-app replay.
- Treat the 2026-09 packet as selector-evaluator evidence, not collection
  acceptance. ShiftX has not received `collection()` yet.
- Preserve proactive cycle checks, transient-prefix visibility, first-read
  blame, and canonical positive paths. Do not substitute active-stack-only or
  topology-version-only proof skipping.
- Keep negative proof reuse inside one prefix revalidation and one exact graph
  observation. Retain only maps from fully exhausted negative searches; never
  retain a positive or partial traversal.
- Use at most two learned closures. Lock the first closure with demonstrated
  overlap, ignore terminal-only eviction, disable after the third disjoint
  non-terminal proof, and reset a locked closure's miss streak whenever it is
  reused within that synchronous batch.
- Pin empty/singleton behavior, a wide shared hub, two initially disjoint heavy
  closures followed by terminal noise and later reuse, and all-disjoint
  fallback. Run packet-shaped cases through both the default and inspected
  cycle-search strategies.
- Force a real site-0 positive cycle after one negative closure is learned.
  Require the unchanged error identity, canonical path, first offending edge,
  installed attempted-prefix truncation, and fast/inspection parity.
- Keep new-edge proofs unchanged and rerun the existing scratch, hydration,
  same-session transient, cross-host, seeded-DAG, and selector-oracle cases.
- Use exact adjacency reads plus inspection `cycle.searches`, `cycle.visits`,
  and `found` as the deterministic performance gate. Wall timing is diagnostic.
- The supplied ShiftX standalone script must remain a semantic smoke because it
  does not reproduce the packet's hot prefix wave. Final acceptance requires a
  real ShiftX snapback capture with unchanged outputs/notifications and a
  material reduction from 55,885 prefix searches / 80,905,365 visits.

## Contract and packaging gates

- Pin root `State<Value>` as exactly the discriminated Atom | Selector |
  readonly collection-row | readonly collection union over the private invariant
  base, preserving `State.kind` narrowing. Keep family factory admission
  Atom-or-Selector only.
- Pin the exact root runtime/type/error export set for `collection`, `presence`,
  `Collection`, `CollectionKey`, `CollectionValue`, `CollectionRow`,
  `CollectionOptions`, `InvalidCollectionKeyError`,
  `InvalidSynchronousCollectionValueError`, `UndefinedCollectionValueError`, and
  `MissingCollectionRowError` in direct and namespace entrypoints.
- Exercise row set/update/reset/delete through both public Store and Transaction
  cursors, including nested scopes and retained closed cursors. Remove the
  temporary production internal row-writer/transaction helper and migrate
  internal semantic suites through a test-only adapter over the public cursor.
- Reject at compile time a `Value` generic containing `undefined`,
  `set(row, undefined)`, an undefined updater result, `delete(atom)`, and
  mutation of readonly row/collection sources. Function values use `set`, never
  updater dispatch. Reject foreign-domain handles at runtime with exact
  `RuntimeMismatchError` identity.
- Declaration-emit installed-consumer fixtures export direct, rich-input, and
  generic-wrapper collection bindings so an unnameable inferred private type
  cannot escape.
- Cover row, collection-membership, and presence-selector reads through derived
  selectors, adapter hydration, and React universal/SSR reads; pin the React
  root surface without adding collection-specific scheduling or ownership.
- Reconcile materialization priority to exactly `"user-visible" | "background"`
  in the contract type spike even though materialization runtime stays deferred.
- Keep `CollectionOptions.indexes` closed as `indexes?: never`; accept no index
  descriptor or ignored option in this beta.
- Through T6, keep immutable ordinary raw ceilings and the fixed provisional
  71-byte gzip seam cap unchanged, alongside graph/no-call/no-allocation/
  deterministic counter/trace gates. T8 replaces that provisional cap with the
  exact no-cushion 62-byte allowance and certifies three byte-identical
  pinned-Bun builds, packed consumers, separately reviewed collection feature
  budgets, and the final seconds-scale advisory timing smoke.
