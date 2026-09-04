# Native collection foundation

Status: implementation plan; reviewed against the approved v1 reference model,
the collection-operation spike, the beta.27 runtime, the selector-session fix,
and the 2024-10-10 ShiftX audit snapshot.

## Outcome

Ship one complete, unindexed collection vertical slice before structural
indexes, materialization, queries, artifacts, React scheduling, or search:

- a callable/readable `collection` definition;
- weak, stable row-handle identity with inert canonical `row.key` metadata;
- `presence(row)`;
- direct and transactional row `get`, `set`, `update`, `reset`, and `delete`;
- explicit absence, scoped tombstones, and live inheritance;
- stable effective-insertion-order membership snapshots;
- one atomic atom-and-row commit, propagation, and notification pipeline;
- exact scratch-overlay reads for rows, presence, collections, and selectors;
- bounded structural inspection counters without row keys or values; and
- a differential public-runtime driver against the existing reference model.

The first ShiftX acceptance target is the sessions subsystem. It replaces
`sessionAtom(ref) + sessionRefsAtom` with one unindexed collection while keeping
the existing derived filtering selectors. Indexes and queries follow only after
the row/delta substrate is proven in production.

## Why this is next

The ShiftX flight recorder exposed and isolated a core selector-session defect.
That fix belongs to PR #362 and this work stacks on it. Collection does not
replace or hide that performance fix.

ShiftX's clearest collection workaround manually maintains four row families and
four parallel membership arrays in `session-store`. Its central entity/history
system is much larger, has ordering differences, and maintains secondary indexes
by hand. Sessions therefore give us a bounded but real first migration: row
identity, membership, persistence, hydration, deletion, transaction overlay
reads, and derived filtering selectors, without forcing index design into the
foundation.

### ShiftX selector-performance follow-up

The 2026-09 ShiftX feedback packet does not exercise `collection()`; ShiftX does
not have the collection API yet. It does prove that the beta.28 selector fix
left a separate release blocker. One user-visible snapback took 30.15 seconds,
with 21.56 seconds in proactive cycle traversal. Its hottest evaluation ran
55,885 prefix-revalidation proofs and visited 80,905,365 graph nodes without
finding a cycle.

The proactive DAG check remains architecturally required: cached selectors can
close a cycle outside the active evaluation stack, and the first-read edge plus
canonical error path are public diagnostics. The defect is repeated execution,
not the proof itself. A foreign publication causes every accepted dependency to
walk a largely shared downstream closure from scratch.

The correction merged in #364 keeps the existing forward proof but adds one
exact-observation, proposal-local learner. It retains at most two maps produced
by fully exhausted negative searches. The first observed overlap locks the
useful map; terminal noise cannot evict it, and three disjoint non-terminal
proofs disable learning. A locked map tolerates two consecutive disjoint
non-terminal proofs, resets the streak on reuse, and disables on the third miss.
Positive or partial searches publish nothing, new-edge proofs are unchanged, and
no proof survives a graph publication or prefix-revalidation call. This bounds
temporary retained state, avoids a reverse-fan-in cliff, and preserves the
existing path/blame semantics.

Deterministic fast and inspected fixtures now cover a shared hub, the packet's
heavy/heavy/terminal/heavy ordering, all-disjoint fallback, singleton behavior,
and an actual positive prefix cycle with exact path and truncation. The supplied
standalone ShiftX reproduction is only a semantic smoke—it does not recreate the
real 84-million-visit path—so ShiftX must still rerun the real snapback before
its real-app performance acceptance can close.

## Plan-approval baseline

This section records the repository state before T1 implementation began; the
later coverage and task sections report the live implementation checkpoint.

- The test-only reference model owns nine approved collection cases covering
  identity, absence, presence, scoped tombstones, reset, update-existing-only,
  transaction overlays, effective insertion order, stable membership identity,
  and commit-final deltas.
- Adversarial review found three oracle gaps to repair before it becomes the
  differential authority:
    - an unmaterialized child Present shadow can disappear from membership after
      its parent deletes the inherited row; and
    - collapsing `set(A) -> set(B) -> update(A)` to final intents can
      incorrectly assign A's later update sequence as its birth, producing
      `[B, A]` instead of Map-like `[A, B]`; and
    - notification delivery follows global subscription-registration order
      rather than the v1 contract's target first-reaching order. Add
      equal/non-equal shadow cases, preserve each effective absent-to-present
      transition independently from later value or ownership writes, and repair
      root-local native-target notification order. The model has no materialized
      route graph, so cross-scope route order and ordinary presence-Selector
      order are normalized out of differentials and owned by exact runtime
      tests. The runtime matrix also owns subscriber-error `cause`/`causes`.
- The operation spike proves a later index generation can consume prepared,
  inert row deltas. It explicitly does not prove the production preflight owner.
- The current kernel already has one flat TreeDraft, guarded updater callbacks,
  inert final preflight, all-source apply, one propagation settlement, and
  after-stability notifications.
- Scope nodes already model weak inherited source routes for atoms and
  selectors.
- The structural inspector already records bounded operation/commit work without
  retaining application values.

At plan approval, the production runtime had no collection definitions, row
sources, tombstones, membership sources, row intents, or collection scratch
overlay.

## Public API decision

The manifest freezes the root exports `collection` and `presence`, the exact
`Collection`/`CollectionRow` type coordinates and generic order, and the
`encodeKey` and future `indexes` option coordinates. T1 amended that authority
before any runtime surface was exported.

Before T6, the exported `State<Value>` was an Atom-or-Selector union and could
not represent a readonly collection source. T1-T5 introduced the
private-symbol-branded invariant base and internal readonly arms while keeping
the exported alias narrow. The T6 checkpoint atomically widens the exported
union with the root collection API. Internals retain separate discriminated
`AnyState` and `DefinitionState` unions for exhaustive dispatch and
family-factory admission. The latter remains Atom-or-Selector: widening readable
State must not silently let `family` factories return collection rows or
collection definitions.

Accepted T6 shape:

```ts
export type CollectionKey = string | number | bigint | boolean | null
export type CollectionValue =
    | null
    | boolean
    | number
    | bigint
    | string
    | symbol
    | object

/** @internal Not a root export. */
declare const privateStateValue: unique symbol
declare const privateCollectionTypes: unique symbol
declare const privateCollectionOptionTypes: unique symbol

interface StateBase<Value> {
    readonly [privateStateValue]: (value: Value) => Value
}

interface ReadonlyState<Value, Kind extends "collection-row" | "collection">
    extends StateBase<Value> {
    readonly kind: Kind
}

export type State<Value> =
    | Atom<Value>
    | Selector<Value>
    | ReadonlyState<Value, "collection-row">
    | ReadonlyState<Value, "collection">

export interface CollectionRow<
    Key extends CollectionKey,
    Value extends CollectionValue,
> extends ReadonlyState<Value | undefined, "collection-row"> {
    readonly kind: "collection-row"
    readonly key: Key
}

export interface Collection<
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input = Key,
    Indexes = never,
> extends ReadonlyState<readonly CollectionRow<Key, Value>[], "collection"> {
    readonly kind: "collection"
    readonly [privateCollectionTypes]: {
        readonly key: Key
        readonly value: Value
        readonly indexes: Indexes
        readonly input: Input
    }
    (input: Input): CollectionRow<Key, Value>
}

interface CollectionOptionCarrier<
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input,
> {
    readonly indexes?: never
    readonly [privateCollectionOptionTypes]?: {
        readonly key: (key: Key) => Key
        readonly value: (value: Value) => Value
        readonly input: (input: Input) => Input
    }
}

export type CollectionOptions<
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input = Key,
> = CollectionOptionCarrier<Key, Value, Input> &
    (
        | { readonly encodeKey: (input: Input) => Key }
        | ([Input] extends [Key] ? { readonly encodeKey?: never } : never)
    )

export function collection<
    Key extends CollectionKey,
    Value extends CollectionValue,
>(options?: CollectionOptions<Key, Value, Key>): Collection<Key, Value, Key>

export function collection<
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input,
>(options: CollectionOptions<Key, Value, Input>): Collection<Key, Value, Input>

export function presence<
    Key extends CollectionKey,
    Value extends CollectionValue,
>(row: CollectionRow<Key, Value>): Selector<boolean>
```

`StateBase` is not exported. The public `State<Value>` remains a discriminated
union, so `state.kind` and Atom/Selector narrowing continue to work. Internals
use a still-more-specific `AnyState` union tied to same-domain definition maps.

Store and Transaction row overloads are explicit so a row write accepts `Value`,
while a row read returns `Value | undefined`. Row overloads precede Atom
overloads to preserve inference:

```ts
interface Store {
    get<Value>(state: State<Value>): Value
    sub<Value>(state: State<Value>, callback: () => void): () => void
    set<Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
        value: Value,
    ): void
    set<Value>(atom: Atom<Value>, value: Value): void
    update<Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
        updater: (current: Value) => Value,
    ): void
    update<Value>(atom: Atom<Value>, updater: (current: Value) => Value): void
    reset<Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
    ): void
    reset<Value>(atom: Atom<Value>): void
    delete<Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
    ): void
}

interface Transaction {
    get<Value>(state: State<Value>): Value
    set<Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
        value: Value,
    ): void
    set<Value>(atom: Atom<Value>, value: Value): void
    update<Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
        updater: (current: Value) => Value,
    ): void
    update<Value>(atom: Atom<Value>, updater: (current: Value) => Value): void
    reset<Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
    ): void
    reset<Value>(atom: Atom<Value>): void
    delete<Key extends CollectionKey, Value extends CollectionValue>(
        row: CollectionRow<Key, Value>,
    ): void
}
```

Compile-only negatives pin the boundary: `Value` cannot include `undefined`; row
`set` and updater results cannot be `undefined`; Atom cannot enter `delete`;
readonly collection sources cannot enter row mutation targets; and function
values use `set` rather than updater dispatch. Same-shape fakes and foreign-
runtime rows/collections/presence selectors are runtime rejection tests because
the public types carry no domain parameter. The options bag has exactly
`encodeKey` plus the staged `indexes?: never` coordinate.

The result type uses canonical key, value, optional richer lookup input, then
inferred index metadata. Input stays third so consumers can naturally annotate
`Collection<Key, Value, RichInput>`; an inference-only exported handle or a
staging-only public `NoCollectionIndexes` placeholder is rejected. The built-in
`never` default keeps declaration emit nameable while the private collection
phantom makes the fourth slot real. A future indexed beta replaces the closed
`indexes?: never` property with a frozen indexed-options interface/overload and
returns `Collection<Key, Value, Input, Indexes>`. It does not intersect a
required map with `never`. The ordinary ShiftX declaration is:

```ts
const sessions = collection<SessionRef, Session>()
```

`collection(input)` returns a row handle. `store.get(collection)` returns the
stable readonly effective-membership array. There is no `.at`, `.rows`,
`collection(existingFamily)`, default row factory, Store `has`, or implicit
membership on lookup/read.

The first slice implements the approved `encodeKey` subset. `CollectionOptions`
spells `indexes?: never`, runtime rejects any own `indexes` key, and no
`collection.indexes` property or descriptor type ships. The already-approved
final-v1 `CollectionOptions.indexes` coordinate remains explicitly planned in
the target manifest. Adding it in the next beta is preferable to accepting
unusable extractors or silently ignoring them.

Recommended stable errors for this slice are:

- `InvalidCollectionKeyError` for an invalid direct or encoded key;
- `InvalidSynchronousCollectionValueError` for thenable values/results;
- `UndefinedCollectionValueError` for the reserved absence value; and
- `MissingCollectionRowError` for an absent-row update.

The exact stable codes are respectively `VALDRES_INVALID_COLLECTION_KEY`,
`VALDRES_INVALID_SYNCHRONOUS_COLLECTION_VALUE`,
`VALDRES_UNDEFINED_COLLECTION_VALUE`, and `VALDRES_MISSING_COLLECTION_ROW`.

Every class has a stable code and immutable diagnostic-only shape. The contract
patch must either freeze these names or explicitly replace them before the root
surface ships.

The same contract pass reconciles the compile-only materialization option with
the already-frozen target vocabulary `"user-visible" | "background"`. This does
not ship materialization runtime; it prevents the contract type spike from
claiming that the priority coordinate is still open.

### Alternatives recorded for review

1. **Callable/readable collection (recommended).** Matches the recovery plan,
   query type experiments, concise ShiftX use, and tree-shakes standalone query
   tiers.
2. **`collection.row(key)` plus a separate membership State.** More explicit but
   adds two concepts and contradicts the approved no-`.at`/parallel-row-node
   direction.
3. **`collection(existingFamily)`.** Rejected: late attachment misses existing
   rows and recreates split identity/membership ownership.
4. **Collection rows as ordinary family Atoms.** Rejected: `undefined`,
   tombstones, delete/reset, membership order, and commit-final deltas have
   different semantics.
5. **Ship index instances/queries in the first slice.** Rejected: operational
   generation, scan/query behavior, and materialization policy are not needed
   for the sessions acceptance case.
6. **Accept index descriptors but ignore them.** Rejected: an accepted
   definition-bound extractor must participate in guarded preflight and abort
   atom/row apply on failure. Silent partial support is worse than a staged
   closed option surface.
7. **Export a `NoCollectionIndexes` placeholder and public `collection.indexes`
   property now.** Rejected: built-in `never` is a nameable fourth default and
   later indexed results remain compatible without staging- only API surface.
8. **Put `Indexes` third to match the query spike.** Rejected: unindexed rich-
   input handles become impossible to annotate without exporting a staging-only
   placeholder. Input is user-authored and stays third; inferred downstream
   index metadata is fourth.

## Architecture

```text
definition plane                         StoreTree plane

collection(options)                     ScopeNode
  |                                       |- rowLocals
  |- weak canonical row cache             |- ownedRows (strong pins)
  |- weak presence-selector cache          |- RowView routes
  `- immutable definition                 `- MembershipRecord routes
         |                                         |
         v                                         v
collection(input) -> CollectionRow       TreeDraft final row intents
                         |                Present | Absent | Reset + sequence
                         `------------------------|
                                                  v
                                guarded resolution / inert preflight
                                                  |
                                                  v
                          apply atom + row owners and membership snapshots
                                                  |
                                                  v
                         one propagation -> one notification snapshot
```

### Definition plane

Extract the family's generic weak primitive-member machinery into a
side-effect-free `weak-member-cache` module, preserving every family behavior
and tree-shaking gate. The collection-definition module composes that cache; it
never imports or wraps the public family API. A collection owns:

- immutable definition metadata;
- a weak `Map<CollectionKey, WeakRef<Row>>` identity cache;
- generation-checked finalizer cleanup with synchronous dead-ref repair; and
- a weak row-to-presence-selector cache.

Direct keys are canonicalized as follows:

- strings, bigint, boolean, and null retain exact identity;
- finite numbers are accepted and `-0` canonicalizes to `0`;
- `undefined`, `NaN`, infinities, symbols, objects, and functions reject.

An encoder runs in the existing definition-only guarded callback domain before
row-cache access. Original rich inputs are not retained. A throw, thenable,
invalid key, or captured runtime capability creates no row handle or cache
entry. Row handles are frozen same-domain readonly States. `presence(row)`
weakly memoizes an ordinary selector equivalent to `get(row) !== undefined`, so
it needs no third native source kind or route. A collection handle is a frozen
callable same-domain readonly State.

After family lands, generalize its definition-accessor guard so collection and
family accessors both reject recursive/captured use from key encoders before
cache descent. Family factory result typing/admission remains Atom-or-Selector
even though public readable State becomes wider.

The definition slice also widens only the internal `AnyState` dispatch union and
adds narrow helpers in `committed-store-tree.ts` for lazy registry creation,
same-domain handle branding/registration, and owner lookup. This core seam is
required because the domain records are deliberately private; `collection.ts`
must not reach through that boundary or construct an unowned lookalike. The
exported `State` alias remains Atom-or-Selector until the public slice, and
family admission narrows explicitly to the same two definition kinds.

The dependency direction is one-way. The side-effect-free collection definition
module imports narrow core registration and guard functions; the eagerly
constructed runtime domain never imports the weak row cache or collection
kernel. Core retains only a small optional collection-vtable slot and kind
dispatch. The first collection definition installs a tree-shakeable
`collection-kernel` implementation into its exact runtime domain. Its first
slice owns draft and scratch-read hooks plus TreeDraft-registered cleanup; row
intents fail preflight before any Atom mutation until the following scope slice
supplies real owner/apply/rewire/publication behavior. That kernel owns lazy
per-domain WeakMaps keyed by TreeDraft and ScopeNode for draft lanes, scope
sidecars, routing, and lifecycle state. Core transaction, scratch, scope,
commit, and disposal paths call the optional vtable hooks but do not know the
collection data structures. The draft slice reserves the existing guarded
resolution and commit-phase slots; the scope slice activates preflight, apply,
rewire, publish, and disposal behavior. These hooks never run a second mutation,
propagation, or notification engine. No global mutable registry or import-time
plugin registration is allowed. Therefore a bundle that uses Store but not
`collection` retains only the reviewed optional-hook seam and allocates no
collection registry, cache, draft lane, or scope sidecar.

WeakMap ownership is not cleanup: a captured closed Transaction cursor may keep
its TreeDraft alive. Each collection lane therefore registers its cleanup
directly with `TreeDraft.installRows`; `TreeDraft.release()` invokes that
callback from its existing finally path. Successful commit, callback abort,
preflight/admission failure, and committed-error exit all delete or clear row
intents, staged values, enabling history, and scratch membership memos. Scope
disposal similarly invokes one kernel hook to detach weak routes, clear pins and
snapshots, and invalidate records even when an application retains the disposed
facade.

### Scope ownership

Each live scope has one optional collection sidecar, allocated only when a row
is written or a row/presence/collection is materialized:

```text
rowLocals: WeakMap<Row, Present(value) | Absent>
ownedRows: Set<Row>                    // only local Present/Absent owners
rowViews: WeakMap<Row, RowView>
liveRowViews: WeakHandleSet<RowView>   // weak-enumerable disposal mirror
memberships: WeakMap<Collection, MembershipRecord>
liveMemberships: WeakHandleSet<MembershipRecord>
```

`ownedRows` is a retention mirror, not enumeration. It pins a row while the
scope owns either a present value or a tombstone. Reset removes the pin. Scope
disposal clears every pin and membership snapshot. Ordinary row lookup/read does
not add ownership. Atom-only scopes allocate none of these maps or sets. The two
`WeakHandleSet` mirrors make synchronous postorder route detachment possible
without strongly retaining row or collection definitions; records are registered
on materialization and removed exactly once on disposal.

An effective membership snapshot strongly retains its present row handles. Every
ownership-changing local row write materializes that scope's membership record
and the required ancestor route path, even when nobody has read the collection
yet; this preserves historical insertion order. A row read or presence read
creates only a RowView and never membership state. A collection read may
materialize the membership path lazily. Weak routes then update only scopes with
collection history. A never-touched child has no MembershipRecord and pays no
ongoing collection cost; its first collection read materializes the exact-parent
path and freezes a coordinate-local copy of the inherited order. Every
`(StoreTree, scope, collection)` exposes its own stable public array identity;
the first child collection read freezes a coordinate-local array rather than
returning the parent's reference. Commit never enumerates all live scopes or the
weak definition cache. Application-retained old immutable membership arrays may
continue to retain removed row handles; releasing those arrays releases that
application-owned retention path.

### Reads

- Row read: nearest final/staged Present wins; Absent stops; Reset/inherit walks
  to the parent; root fallthrough is `undefined`.
- Row outcomes use `Object.is` with no comparator option. Same-value and
  `NaN`-to-`NaN` writes are effective no-ops; `-0`-to-`0` changes the row token.
- Presence read: a weakly cached ordinary selector maps the row outcome to a
  boolean. Value-only changes may reevaluate it, but `Object.is` preserves its
  result/token and it does not notify.
- Collection read: one frozen ordered array of effective row handles.
- Value-only row changes preserve the exact collection array/token.
- Selector reads use the existing evaluator; row, presence, and collection are
  ordinary source dependencies.
- Transaction reads use the same TreeDraft overlay. A collection-local row
  revision and memo preserve exact membership array identity across unrelated
  Atom writes; a relevant row intent recomputes and reuses the prior array when
  ordered membership is unchanged.

### Intents and order

TreeDraft keeps its existing inline Atom fast path and adds one lazily
allocated, separate row-intent lane. Row intents are:

```text
Present(value, sequence) | Absent(sequence) | Reset(sequence)
```

`set` is upsert. `update` first resolves effective draft presence and rejects
before invoking its updater when absent. `delete` establishes local Absent at a
child; root delete removes ownership because root absence needs no tombstone.
`reset` removes local Present or Absent and reconnects inheritance.

One tree-wide monotonically increasing draft sequence is assigned to every
successfully staged row intent. Draft resolution also records the last effective
absent-to-present transition that remains continuous through the final state.
Later present-to-present value, ownership, or routing changes retain that
`enablingSequence`; delete/reset to effective absence followed by reintroduction
records a new one. This cannot be derived only from the collapsed final local
intent. After final-intent collapse, a baseline-absent row's birth uses the
latest required enabling sequence on the final target-to-owner path. No-op
resets, overwritten values, and continuously-present writes never reorder
membership.

### Atomic commit

```text
callback returns
      |
      v
guarded row-delta resolution          (no index extractor in this PR)
      |
      v
freeze final atom + row intents
      |
      v
inert preflight: owner cells, effective outcomes, routes, membership arrays
      |
      v
apply every atom + row owner
      |
      v
rewire every materialized AtomView + RowView + MembershipRecord
      |
      v
publish changed source tokens
      |
      v
mark Atom targets in existing order, RowViews in final row-plan order,
and MembershipRecords parent-before-child
      |
      v
one selector propagation and one callback snapshot
```

No selector or subscriber observes partially applied atom/row state. Ownership-
only changes advance the tree source epoch but do not notify value, presence, or
membership subscribers. An admission/preflight error changes nothing. Derived or
subscriber errors after apply retain the existing committed-error behavior. The
fixed source order preserves existing Atom first-reaching order and adds
deterministic row and membership coordinates before the one selector queue
drains:

1. Existing Atom targets keep their current affected-order slots.
2. Row coordinates take a stable slot on first insertion into the final row
   plan. Each coordinate traverses materialized routes parent-first depth-first;
   siblings use route-insertion order; first discovery deduplicates a target.
3. Collections take a stable slot when first encountered in row-plan traversal.
   Membership records then traverse parent-first depth-first with sibling
   route-insertion order and first-discovery deduplication.

This category order defines cross-collection interleave. Selector targets retain
dependency-first discovery from that source queue. All-fire subscriber-error
aggregation delivers targets in the same first-reaching order and callbacks on
one target in subscription-registration order; duplicate target subscriptions
still fire independently. With subscriber errors only,
`SubscriberNotificationError.cause` is the first throw and `causes` contains
every throw including the first in delivery order. An authoritative post-apply
`RuntimeMismatchError` throws directly when no subscriber fails; when both
coexist, all callbacks still fire and the aggregate has `cause === mismatch` and
`causes === [mismatch, ...subscriberThrowsInDeliveryOrder]`.

The future index PR plugs guarded extractor preparation before inert preflight
and consumes immutable prepared row deltas. It does not move extractor calls
into apply or add a second mutation engine.

### Inspection and privacy

The structural recorder may add fixed counters and safe references for:

- row intents by operation;
- effective row changes;
- membership inserts/removes;
- row/membership source publications and presence-selector evaluations; and
- route/materialization work.

It must never retain/export row values, canonical row keys, encoder inputs,
extractor outputs, callbacks, or errors. Collection and row references use
opaque recorder IDs. Overflow-safe summary totals remain exact.

The collection counter names and schema mapping live with the optional
kernel/inspect extension, not in the always-retained committed-store-tree
counter table. Core reserves only a numeric extension range and an optional
record hook. This keeps collection strings and mappings out of ordinary Store
bundles while preserving append-only counter numbering once the extension is
installed.

T7 freezes that transport as one optional numeric recorder reached through the
touched scope's existing Store coordinator. Counter codes `35..48` map, in the
order listed under Performance requirements, to the fourteen collection
counters; detail codes `64..76` distinguish canonical row intents, prepared
effective changes, membership changes, source publication, and materialization.
The runtime domain and collection vtable do not grow. Every retained summary
exposes all fourteen flat totals, including zeros. Counter accumulation is
independent of bounded detail retention, so a detail capacity of zero or a
wrapped detail ring changes only `overflow.details`/`complete`, never the totals
on a retained operation, commit, or span. Read-time materialization contributes
totals only when the caller deliberately encloses it in `inspect.span`; T7 does
not invent a report-wide aggregate or change the existing interval model.

Collection inspection details contain only opaque scope, collection, and row
references plus structural enums (`set`/`update`/`reset`/`delete`,
`insert`/`update`/`remove`, `published`/`materialized`). `capture` classifies a
same-domain row or collection only after ordinary State ownership succeeds and
uses the frozen `kind` data descriptor; it never reads `row.key`. Direct
`Store.delete` becomes a first-class inspected operation, while transaction
delete remains part of its enclosing transaction interval.

Effective-delta evidence is authoritative only for RowViews materialized before
the corresponding commit. Membership publication evidence is likewise
authoritative only for MembershipRecords that existed before the commit. Public
reads and subscriptions may materialize either source; ownership work may
install membership paths without materializing a RowView. The differential
therefore ingests structural materialization details in sequence, projects the
model against the pre-commit authority set, and admits phase-0/rewire/subscriber
materializations only for later commands. It never prewarms every scope or
enumerates all live scopes merely for inspection. Cross-scope delta cases may
explicitly materialize only named coordinates; V1M-COLLECTION-010 deliberately
keeps its child RowView cold and compares public semantics after projecting away
that cold coordinate. The model keeps record-localization work in its commit
audit but marks whether ordered membership actually changed; only those
source-changing entries predict a runtime membership publication.

## Failure-mode audit

| Failure/path                                  | Planned test                     | Handling                                             | User outcome                         |
| --------------------------------------------- | -------------------------------- | ---------------------------------------------------- | ------------------------------------ |
| Invalid direct/encoded key                    | definition key matrix            | Reject before cache/Store work                       | Named, clear error                   |
| Encoder throw/thenable/captured Store         | encoder quarantine matrix        | Preserve exact guarded fault; cache nothing          | Clear error                          |
| `set`/updater returns `undefined` or thenable | row admission matrix             | Reject before intent; contain rejection              | Named, clear error                   |
| Update absent/tombstoned row                  | direct + draft update cases      | Do not invoke updater                                | `MissingCollectionRowError`          |
| Callback abort or preflight failure           | mixed Atom/row atomicity         | Release draft; apply nothing                         | Original clear error                 |
| Child delete while parent absent/present      | scope/tombstone matrix           | Retain local Absent owner and pin                    | Intentional hidden row               |
| Child reset after tombstone                   | reset/reinsert order matrix      | Reconnect inheritance; birth only after real absence | Deterministic membership             |
| Same-value/`NaN` or `-0`→`0` write            | Object.is matrix                 | No-op for former; row-only publish for latter        | No silent stale selector             |
| Equal ownership/routing transition            | parent change after equal shadow | Rewire without value/membership callback             | Future inheritance stays live        |
| Subscriber throw(s)                           | callback/error ledger matrix     | Commit stays installed; all callbacks fire           | Exact aggregate error                |
| Post-apply mismatch plus subscriber throws    | mixed authoritative-fault case   | Mismatch leads full frozen causes ledger             | Exact aggregate error                |
| Closed cursor retains TreeDraft               | registered-cleanup exit matrix   | Explicitly clear kernel values/memos                 | Closed-cursor error; no leak         |
| Store/scope disposal with retained handles    | lifecycle + two-Store cases      | Detach routes, clear pins; keep definitions valid    | Disposed facade rejects clearly      |
| Foreign branded row/collection/presence       | runtime ownership matrix         | Reject before kind/liveness/work                     | Exact `RuntimeMismatchError`         |
| Unbranded same-shape fake                     | target-admission matrix          | Reject before liveness/work                          | Invalid-State/target `TypeError`     |
| Stale weak-cache finalizer                    | fake finalizer generation test   | Identity check preserves replacement                 | No visible failure                   |
| Persistence subscription insert/delete races  | ShiftX adapter race fixture      | Preattach and generation-check cleanup               | No lost/stale persisted row          |
| Legacy migration crash after any write        | fault-injected migration fixture | Resume from complete staging manifest                | Old or complete new view, never half |
| Detail ring overflows during collection work  | inspect capacity `0`/`1` matrix  | Count before bounded detail insertion                | Incomplete report with exact totals  |
| Differential inspection materializes cold row | cold-child V1M-010 translation   | Project to already-materialized coordinates only     | No semantic or route-order drift     |

## Performance requirements

Normal atom/selector consumers remain the control:

- no collection implementation retained by an atom-only bundle beyond the
  reviewed narrow State-kind seam;
- no collection map/allocation on an atom-only Store, transaction, or commit;
- after one collection installs the domain vtable, a fresh Store/transaction
  doing Atom-only work still allocates no collection draft/scope state, records
  zero collection counters, and passes the deterministic rebuild/placement
  traces; a standalone warmed Bun smoke targets <=10% and fails only at a
  catastrophic >=50% installed/control wall-time delta;
- ordinary core-retaining fixtures keep their exact pre-collection baselines;
  the named **COL-004 native-collection core gzip seam waiver** provisionally
  permits at most 71 gzip bytes above their existing 2% ceilings, adds no raw
  allowance, and changes none of the graph, no-call, no-allocation, or
  deterministic counter/trace gates;
- row-cache hit is O(1) and allocates nothing;
- `Object.is`-distinct present-to-present row update performs no collection-size
  membership rebuild;
- insert/delete may copy each affected materialized membership array at most
  once;
- work scales with touched rows and materialized inheritance routes, not all
  defined row handles;
- no index extractor, query scan, or user callback runs during apply; and
- high-cardinality absent row-handle creation remains weak and reclaimable.

Use deterministic 1k/5k/20k-row identity, counter, and trace fixtures for direct
and encoded lookup, value updates, inserts, deletes, and transaction overlay
reads. A dedicated absent-read case pins zero membership/owner work, while the
separate sparse-fanout case pins zero unrelated route visits below 20k sibling
scopes. Exact route visits, row scans, allocations, publications, and
cardinality-independent inspection detail attempts are binding. Run the two
remaining Atom-only constant-factor checks as one explicitly warmed standalone
Bun process: fixed 40k direct and 20k transaction batches, eight adjacent AB/BA
rounds, `Bun.nanoseconds` wall timing, and `process.cpuUsage` diagnostics. The
geometric-median installed/control wall ratio has an advisory <=1.10 target and
only >=1.50 is a hard smoke failure; no raw timing samples are persisted. The
performance-policy commands run from `packages/valdres`. Add an explicit
collection bundle fixture and separately reviewed feature budgets for `dist`,
`packed`, `all-exports`, `inspect`, and the collection fixture. Inspection is a
feature fixture after COL-007, not an ordinary-control ratchet. Do not refresh
the ordinary control baselines or use an aggregate ratchet to hide retained
collection code. COL-008 certified three byte-identical builds on pinned Bun
1.4.0 and replaced the provisional waiver with a fixed 62-byte allowance: the
exact maximum gzip overage above the immutable 2% ceilings across the affected
ordinary fixtures, with no cushion. Any later increase requires explicit
architecture review; both shipped runtime graphs and the no-call, no-allocation,
deterministic counter/trace, and raw-byte gates do not move.

Required counters append after existing family counters without renumbering:

- `collectionRowIntentsStaged` and `collectionRowIntentStorageAllocations`;
- `collectionRowFinalResolutionVisits` and `collectionRowRouteVisits`;
- `collectionMembershipRecordCreations`, `collectionMembershipRouteVisits`, and
  `collectionMembershipRowsScanned`;
- `collectionMembershipArrayAllocations`;
- `collectionRowSourcesChanged` and `collectionMembershipSourcesChanged`;
- `collectionEffectiveDeltasPrepared`; and
- `collectionOwnerRetentionSetsCreated`, `collectionOwnerRetains`, and
  `collectionOwnerReleases`.

Their work boundaries are exact. `collectionRowIntentsStaged` counts every
accepted non-noop row event, including overwritten, caught, and ultimately
aborted events. `collectionRowIntentStorageAllocations` counts once on the first
accepted row event in a draft; read-only lanes, rejected updates, and semantic
no-ops are excluded. Final-resolution visits count final plan coordinates.
Row-route visits count coordinates entered by committed RowView materialization,
rewire materialization, or affected-route traversal. Membership-route visits
count ancestry nodes entered while materializing or constructing a plan path and
nodes entered by the affected-route traversal. An immediate plan-map or snapshot
memo hit performs no route walk and counts zero. Disposal is deliberately
outside both route-visit counters; owner releases and the existing route-removal
instrumentation cover that lifecycle work.

Membership-row scans count each array or placement entry actually examined while
constructing, comparing, or reusing a draft/committed membership snapshot. They
exclude inspection-only detail diffing and cached snapshot returns that examine
no entries. Membership insert/remove classification piggybacks on the existing
placement/snapshot pass. When phase 0 must emit or overflow-count those details,
the plan aliases the already-built touched-placement map and iterates that
alias; it adds no second membership snapshot diff, Set, or collection-sized
buffer. Membership-array allocations count only newly frozen snapshots, not
shared empties or exact-reference reuse. Source counters count phase-2
publications; effective deltas count differing prepared materialized RowViews.
Owner-retention counters count Set creation, absent-to-present pin transitions,
and successful removal (including the exact retained-owner cardinality released
by disposal).

Atom-only work increments every collection counter by zero. Present-to-present
updates have zero membership scans/arrays/publications independent of collection
size. A commit rebuilds each affected MembershipRecord at most once. No-op root
delete/reset changes no epoch, propagation, notification, or delta counter.
Child delete while already effectively absent creates one tombstone pin and
advances the ownership epoch, but changes zero source/delta counters. A mixed
Atom+row commit performs one propagation settlement and one callback snapshot.

## Coverage map

```text
[TESTED] pure model plan-approval baseline
  collections.test.ts V1M-COLLECTION-001..009 (9 tests / 183 assertions)
      |
      +-- [TESTED T1] V1M-COLLECTION-010..012
      |       child history + enabling sequence + target delivery order
      |
      +-- [TESTED T5] V1M-COLLECTION-013..015
      |       true-gap rebirth + child shadow + draft memo restoration
      |
[TESTED T2] collection() -> weak row cache -> presence Selector
  collection-definition.test.ts + declaration-emit consumer
      |
[TESTED T3] Store/txn call -> row intent history -> scratch membership memo
  collection-draft.test.ts (success/abort/preflight/error release paths)
      |
[TESTED T4] scope local Present/Absent -> RowView route -> disposal mirror
  collection-rows.test.ts + collection-lifecycle.test.ts
      |
[TESTED T5] one commit preflight/apply/publish
  Atom -> RowView -> MembershipRecord -> dependent Selector -> callbacks
  collection-membership.test.ts + collection-subscriptions.test.ts
      |
[TESTED T6] public State/root API -> Store/Transaction/selector/adapter/React
  public-candidate type/runtime/export/declaration probes + React universal reads
      |
[TESTED T7] inspect -> repaired model public-runtime differential
  collection-differential.test.ts + v1-inspect
      |
[TESTED T8] tarball/runtime/lifecycle/scale evidence
  triple build + package size + packed Node/Bun/TS/esbuild/React18/19
      |
[TESTED T9] ShiftX sessions user flow
  hydrate -> filtered selectors -> update -> logout -> reinsert -> restart
  shiftx-sessions.test.ts with persistence races + legacy crash injection
      |
[LANDED T10 / SHIFTX REPLAY PENDING] selector prefix negative-proof reuse
  merged #364 -> exact path parity -> real ShiftX replay pending
```

The plan-approval baseline was 9 pure-model tests / 183 assertions and no
production collection tests. The implemented T1-through-T7 plus T9 checkpoint
has 15 collection-model cases / 304 assertions plus mirrored internal runtime
cases, the seeded public-runtime differential, the public root/type/React
surface, and the test-local ShiftX migration adapter. The T10 selector
correction is merged and locally deterministic but still needs the real ShiftX
replay. T8 package evidence is certified on the reconciled source. The model
repairs cover child-shadow history, enabling-sequence order, native notification
order, and same-draft true-gap rebirth/memo restoration. Presence notification
ordering is not compared as a direct model target: production `presence(row)` is
an ordinary Selector, so dedicated runtime tests own its dependency-first
ordering and exact subscriber-error identity. The model's root-local
Atom/row/collection order is authoritative; cross-scope route order is
normalized because the model intentionally has no materialization graph.

Inline ASCII comments belong in `collection-kernel.ts` for the intent-to-commit
phase pipeline and effective membership state machine, and beside the optional
extension slot in `runtime-domain.ts` for the one-way install/lifecycle
boundary. `scope-node.ts` gets a small ownership diagram showing weak
RowView/Membership routes versus strong local Present/Absent pins. Do not copy
the full design into call sites.

## Test strategy

1. **Contract/type surface.** Exact root exports, generic inference, invariant
   row values, readonly membership, encoder input/key inference, mutation kind
   rejection, closed options, and named errors.
2. **Pure definition identity.** Key domain, type tags, `-0`, weak repair, stale
   finalizers, encoder quarantine, same/foreign domain, no Store work.
3. **Differential semantics.** First repair the child-shadow, enabling-sequence,
   notification-order, and same-draft true-gap oracle defects and mirror their
   deterministic cases in the internal runtime. In T7, translate every v1-model
   collection command to public runtime operations and compare the expanded
   deterministic suite plus seeded command sequences.
4. **Scope/transaction edge cases.** Tombstones, resets, root/child/sibling
   final overlay order, latest enabling birth sequence, caught errors, mixed
   atom/row atomicity, scratch selector reads, and stable draft snapshots.
5. **Reactivity.** Row vs presence vs membership subscribers, selector chains,
   callback order, error aggregation, no value-only membership notification.
6. **GC/lifecycle.** Absent handles collect; membership/present/tombstone pins;
   child delete retains one tombstone pin; root delete, reset, and disposal
   release applicable pins; subscriptions/dependencies retain only while live;
   named/anonymous scopes and multiple StoreTrees isolate. Disposing one Store
   does not invalidate definitions used by another.
7. **Inspection.** Exact counters after detail overflow, correlations, and no
   raw keys/values.
8. **Packaging.** Node/Bun/TypeScript/esbuild, root surface, React 18/19 read
   compatibility, shared domain, atom-only reachability, and tarball types.
9. **ShiftX acceptance.** Run the sessions migration fixture below before
   claiming the foundation complete.

## ShiftX sessions acceptance

Use two fixed-clock rows, `A` and `B`:

1. Call `sessions(A)` twice and `sessions(B)`; assert stable handle identity,
   inert `row.key`, absent reads, and one exact empty membership snapshot.
2. Call `ensureSubscribed(A)` and `ensureSubscribed(B)`, then in one transaction
   set valid A followed by expired B. Inside the same transaction, read the
   migrated valid/by-user/current-session selectors; they see A only.
3. After commit, membership is `[A, B]` and subscribers see one final state.
   Immediately update A again before any microtask; membership reference stays
   exact, the collection subscriber is silent, and the preattached row
   subscription persists both the insertion and update without an enrollment
   race.
4. Update A present-to-present again; row persistence runs once while membership
   and presence remain exact and silent.
5. Abort creation of C. The inert canonical C handle may remain in the weak
   definition cache, but C stays effectively absent and membership, derived
   selectors, storage, notifications, and live row subscriptions remain
   unchanged. The adapter reconciles provisional preattachments outside the
   failed transaction and disposes C's unused generation.
6. Logout via `txn.delete(A)`; membership becomes `[B]`, derived filtering
   selectors drop A, and the row callback removes A's storage. Reinsert A and
   assert `[B, A]`.
7. Persist each session in an envelope with its monotonic membership birth
   order. Rehydrate a fresh Store by deliberately shuffling loaded envelopes,
   validating unique finite order values, sorting by that order, and setting
   rows only, with no parallel refs array. Seed the next-order allocator to
   `max(restoredOrder, persistedWatermark) + 1`; insert C, restart from another
   shuffled load, and prove `[B, A, C]`. Delete/reinsert receives a fresh order
   above the watermark. Membership and selectors reproduce the post-reinsert
   state exactly.
8. Upgrade legacy plain ShiftX session entries once: preserve the storage
   cursor's currently observed order and atomically write one staging manifest
   containing the complete identity-to-`1..N` mapping plus watermark before any
   per-row mutation. Resumably write and verify versioned envelopes from that
   manifest, copy that complete manifest into the migration marker as the
   visibility switch, and only then remove old entries and the staging manifest.
   Fault-inject after every write; each retry and a second restart must recover
   the same order without exposing a half-migrated Store.
9. Instrument the fixture: absent handle lookup creates no Store work; absent
   row/presence reads create no owner pin or MembershipRecord; value update does
   no collection-size work; report is complete; and no values/keys are exported.

The adapter bootstraps existing membership outside callbacks and preattaches a
row subscription before every first write. A membership callback never calls
`store.sub`; it may read final membership and queue teardown/reconciliation
after deletion. This respects subscriber quarantine and replaces the historical
family-wide invalidation without losing a synchronous insert-then-update. Each
row subscription carries a generation. Queued deletion cleanup rechecks both
generation and final membership so `delete(A) -> ensureSubscribed(A) -> set(A)`
cannot let stale cleanup unsubscribe the reinserted live row. Direct/transaction
write wrappers track provisional preattachments and reconcile them after success
or failure, outside Store callbacks, so an aborted first insert leaves no idle
subscription.

The persisted per-row order, allocator watermark, and one-time legacy upgrade
are app-adapter responsibilities, not collection metadata. Duplicate,
non-finite, or corrupt restored order values reject before any Store write.
Relying on `Object.entries(localStorage)` order after the upgrade is rejected
because a keyed blob store does not promise collection insertion order;
declaring current selectors order-insensitive is also rejected because the
historical current-session selector uses first-match behavior. The legacy
upgrade may use the currently observed cursor order exactly once while it
durably assigns explicit order metadata. A guaranteed ordered storage cursor
would be a valid future alternative if ShiftX can prove it end to end.

The new-adapter startup path rejects legacy or staging state before constructing
a Store until the marker exists. While cleanup is incomplete, it validates the
marker, staging manifest, complete envelope set, and watermark as one view. Once
both staging and legacy entries are gone, the marker remains migration
provenance rather than freezing the original live-session cardinality: normal
delete/reinsert evolution may change envelopes and order, while the allocator
watermark must never predate the marker's migration watermark.

The logout deletion is a deliberate migration decision. The historical ShiftX
code removes the reference but appears to leave the family value/storage entry.
Current ShiftX must confirm that true deletion is desired before production
migration. The attached audit is a sparse snapshot pinned to 2024-10-10 and does
not provide production cardinalities.

The T9 test-local checkpoint implements the adapter and a separate Map/order
oracle in `shiftx-sessions.test.ts`. Four focused cases cover preattached
insert/update persistence, abort reconciliation, transactional logout plus
generation-checked reinsert cleanup, shuffled restart and safe-integer
validation, fault injection after each of ten keyed legacy-migration writes, the
actual marker-gated startup path at every intermediate state, an idempotent
migration retry plus two ordered Store restarts per fault point, post-migration
mutation/restart, and a complete privacy-safe inspection report. This is
compatibility evidence for the historical snapshot; it does not resolve the
current-ShiftX logout decision above or modify ShiftX production code. The final
focused gate passes 4 cases / 222 assertions; the combined public- candidate
TypeScript/runtime/core-load gate passes 154 cases / 15,506 assertions.

## Implementation sequence

The approved delivery plan groups the sequential task lake into four review
slices. The root export appears only at T6, after the internal vertical slice is
complete. This section records that plan; at the current checkpoint T1-T8 and
the task-local T9 ShiftX fixture are accepted. Current real-app logout semantics
and the real ShiftX selector replay remain external acceptance work.

1. **Contract, oracle, and identity.** Repair the three initial reference-model
   defects, reconcile the materialization-priority compile contract, freeze the
   State/type/error coordinates, extract the neutral weak-member cache without
   changing family behavior, and add lazy same-domain collection registrations.
   Nothing is root-exported yet.
2. **Row/draft kernel.** Add the lazy row-intent lane, scratch reads, scoped
   ownership, tombstones, RowViews, and mixed atomic Atom/row apply.
3. **Membership/reactivity.** Add MembershipRecords, order, collection-local
   committed snapshots, effective deltas, selectors, and notifications; reuse
   the draft memo frozen in PR 2. Repaired model cases and mirrored internal
   runtime cases pin the semantics; T7 supplies the public differential.
4. **Public/inspection/performance.** Expose `collection`/`presence`, add
   bounded recorder counters, differential/GC/scale/package coverage, docs, and
   the ShiftX sessions acceptance fixture.

Landing order is the accepted family foundation followed by collection PRs 1-4;
the selector correction is already on main through #364. Family supplies the
reviewed weak cache and definition-callback quarantine, but collection does not
depend on the public `family` API. Index instances, materialization, and queries
begin only after this foundation and the ShiftX sessions migration are accepted.

## Implementation tasks

Synthesized from this review's findings. Each task derives from a concrete gap
above. A checked box records acceptance of that task-local checkpoint. The
remaining ShiftX questions are external real-app acceptance, not missing
collection package evidence.

- [x] **T1 (P1, human: ~2 days / CC: ~90 min)** — Authority — repair the oracle
      and freeze the complete contract/State-base coordinates.
    - Surfaced by: Test/API/DX review — all three initial model defects
      reproduce, exact handle/error types are absent, and a private empty-index
      default fails consumer declaration emit.
    - Files: `test/v1-model/**`, `contracts/v1/**`, internal State types, and
      `test/v1-public-candidate/collection-types.test.ts`.
    - Verify: focused model tests, `bun run check:contracts-v1`,
      public-candidate typecheck, and a `declaration: true` installed-consumer
      probe.
- [x] **T2 (P1, human: ~2 days / CC: ~90 min)** — Definition — extract the
      neutral weak cache and implement row/presence identity.
    - Surfaced by: Architecture review — legacy families mix membership and
      release, while collection lookup must be inert, weak, and Store-free.
    - Files: `src/v1-internal/weak-member-cache.ts`, `family.ts`,
      `collection.ts`, runtime-domain plus committed-domain registration seams,
      and focused definition tests. `public-domain.ts` remains untouched so the
      eagerly constructed domain never imports collection definition code.
    - Verify: focused family-cache and collection-definition tests, build graph,
      and ordinary atom-only allocation/reachability probes.
- [x] **T3 (P1, human: ~3 days / CC: ~2 hours)** — Draft kernel — install the
      optional domain-local vtable and sequenced row-intent overlay.
    - Surfaced by: Architecture/performance review — direct kernel imports
      retain the feature in every Store bundle, while a second engine breaks
      atomicity. A draft-only slice must not silently accept a row commit before
      the scope slice owns real committed storage.
    - Files: `src/v1-internal/collection-kernel.ts`, `collection.ts`,
      runtime-domain and committed-domain optional-vtable seams, TreeDraft,
      scratch host, and `test/v1-committed-store-tree/collection-draft.test.ts`.
    - Verify: focused draft/scratch/closed-cursor release tests, row-intent
      preflight rejection before any Atom mutation, within-draft continuous
      enabling over absent/injected baselines, and unchanged Atom transaction
      counters. Read-only lanes cover successful/committed-error release; staged
      lanes cover callback-abort/preflight release.
- [x] **T4 (P1, human: ~4 days / CC: ~3 hours)** — Scope kernel — implement
      Present/Absent ownership, RowViews, lifecycle mirrors, and mixed apply.
    - Surfaced by: Failure/lifecycle review — tombstones need strong owner pins,
      while weak maps alone cannot synchronously detach retained disposed
      routes. This slice adds real inherited baselines and cross-scope
      continuous enabling, then activates the installed prepare/apply/rewire/
      publication phases so successful row commits become reachable here.
    - Files: collection kernel, narrow scope/commit hooks, row and lifecycle
      tests.
    - Verify: root/child/sibling semantic matrix, mixed preflight atomicity,
      successful and post-apply-error draft release, and deterministic
      disposal/GC tests. One-row sibling-scope staging at 1k/5k/20k rejects
      quadratic fanout; a 1,024-deep inheritance/disposal chain stays iterative.
      Record the named provisional 71-gzip-byte COL-004 seam waiver without
      changing any other control gate.
- [x] **T5 (P1, human: ~4 days / CC: ~3 hours)** — Membership — implement
      history, continuous birth order, stable snapshots, and exact delivery.
    - Surfaced by: Semantics review — final intents lose Map order and public
      callback/error identity requires deterministic first-reaching tie-breaks.
    - Files: collection kernel, narrow commit/subscription hooks, scope
      ownership diagram, repaired collection model cases, row/lifecycle
      adjustments, and membership/subscription tests.
    - Verify: repaired model cases plus mirrored internal runtime cases; exact
      subscriber-only and mixed authoritative-fault `cause/causes` ledgers;
      routing-only silence; one rebuild per affected record; sparse 20k sibling
      traversal; linear 1,024-depth placement; and no increase to the fixed
      71-byte ordinary gzip seam cap. The public differential remains T7-owned.
- [x] **T6 (P1, human: ~2 days / CC: ~90 min)** — Public API — expose the
      complete root surface and widen public State atomically.
    - Surfaced by: Scope/API review — a partial root export would be unusable
      and a broad State migration could silently weaken family admission.
    - Files: `src/v1.ts`, `src/index.ts`, committed-tree State/transaction/store
      dispatch, public-candidate type/runtime/export/declaration tests,
      committed collection tests migrated off the temporary internal row-writer
      helper, and `valdres-react` universal-read/public-surface tests.
    - Checkpoint acceptance: root `collection`, `presence`, named collection
      errors, and collection types land with the four-arm readable `State`
      union; family factories remain Atom-or-Selector. Public Store and
      Transaction row overloads own set/update/reset/delete, the temporary
      production row-writer helper is removed, and direct, rich-input, and
      generic-wrapper declaration emit remains nameable. Row, collection, and
      presence reads cover selectors, adapter hydration, and React universal
      rendering; mutation negatives, closed `indexes?: never`, and exact
      foreign-domain rejection remain pinned. Ordinary controls retain the fixed
      provisional 71-byte gzip seam cap with graph/no-call/no-allocation/
      deterministic counter/trace gates unchanged; T8 still owns the final
      reproducible allowance and packed evidence.
- [x] **T7 (P1, human: ~2 days / CC: ~90 min)** — Inspection/differential — add
      structural recorder hooks and public-runtime oracle coverage.
    - Surfaced by: Privacy/test review — the new source kinds need exact bounded
      evidence without retaining values/keys, and production must match the
      repaired model.
    - Files: numeric collection-inspection protocol; the Store-scope coordinator
      and existing Store trace; collection kernel record sites; inspect
      runtime/tests; shared v1-model scenarios; and
      `test/v1-public-candidate/collection-differential.test.ts`.
    - Verify: exact counter codes and totals through detail-ring overflow;
      row/collection capture and direct-delete operation coverage; zero
      key/value/input/error retention; deterministic cases 001-015 plus seeded
      legal public-runtime traces; materialized-coordinate delta projection;
      membership reference-equivalence checks; exact root-native notification
      order; dedicated presence-Selector delivery/error order; and ordinary
      graph/no-call/no-allocation/counter/trace/size gates.
- [x] **T8 (P1, human: ~2 days / CC: ~90 min)** — Package evidence — prove
      lifecycle, scale, bundle isolation, and installed compatibility.
    - Surfaced by: Lifecycle/performance review — collection implementation must
      be reclaimable, bounded, and absent from ordinary Store artifacts.
    - Files: performance/GC fixtures, immutable size-baseline schema and
      checker, package scripts/toolchain assertions, and packed-consumer
      scripts.
    - Verify: binding exact 1k/5k/20k counters/traces plus a standalone
      seconds-scale warmed Bun Atom-only advisory smoke, three byte-identical
      pinned-Bun-1.4.0 builds, immutable pre-collection ordinary baselines, an
      exact no-cushion 62-byte additive gzip seam allowance, separately reviewed
      collection/dist/packed/all-exports/inspect feature budgets, and
      Node/Bun/TS/esbuild/React 18/19 packed gates. The final reconciled source
      passed this freeze with both production and development graphs retained.
- [x] **T9 (P1, human: ~2 days / CC: ~90 min)** — ShiftX acceptance — run the
      sessions adapter migration fixture.
    - Surfaced by: ShiftX audit — the old family-wide persistence callback has
      no direct membership-only equivalent, and keyed blobs do not encode order.
    - Files: `test/v1-public-candidate/shiftx-sessions.test.ts` and this design.
    - Verify: insertion/update and delete/reinsert races, abort reconciliation,
      watermark/restart order, durable legacy upgrade, and privacy report.
- [x] **T10 (P0, human: ~1 day / CC: ~60 min)** — Selector proof scaling —
      eliminate repeated shared-closure traversal during foreign-publication
      prefix revalidation without weakening proactive cycle safety.
    - Surfaced by: the beta.28 ShiftX snapback packet — one evaluation performs
      55,885 negative prefix proofs / 80,905,365 visits, while all 1,291
      topology-identical evaluations perform zero searches.
    - Landed: #364 owns the selector evaluator, inspection strategy, tests,
      integration notes, and release note. This design/test plan/task ledger
      retain the collection-project handoff and real-app acceptance boundary.
    - Verify: singleton allocation-free behavior; shared-hub near-linear reads;
      packet-shaped heavy/terminal interleave; bounded all-disjoint fallback;
      exact fast/inspected canonical positive path, blame, and truncation; full
      selector/inspection/runtime gates; then a real ShiftX snapback replay.

## Parallelization

| Step          | Modules touched                            | Depends on |
| ------------- | ------------------------------------------ | ---------- |
| T1 authority  | model, contracts, internal types           | —          |
| T2 definition | `v1-internal/` definition modules          | T1         |
| T3 draft      | collection kernel, transaction/scratch     | T2         |
| T4 scope      | collection kernel, scope/commit            | T3         |
| T5 membership | collection kernel, scope/commit            | T4         |
| T6 public     | root API, public candidate/build tests     | T5         |
| T7 inspection | kernel record sites, inspect, differential | T6         |
| T8 package    | lifecycle, performance, packaging          | T7         |
| T9 ShiftX     | public candidate adapter fixture           | T8         |
| T10 selector  | evaluator, inspection, ShiftX replay       | T7         |

The collection implementation is T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9. T10
is an independent selector-runtime correction discovered by the final ShiftX
feedback; it landed through #364 before T8's final source/package
recertification. The kernel tasks share primary modules, so there is no safe
inter-task worktree parallelism. Focused tests within one task may fan out after
its source snapshot is frozen. No two open PRs claim the same prerelease tuple.

## Not in scope

- structural value/multi-value/ordered index descriptors, preparation,
  structures, and query execution;
- `query`, facets, windows, or query result identity;
- `valdres/collection` materialization or scan operations;
- `valdres/collection/artifacts` representation/import/export;
- React auto-materialization or scheduler policy;
- ranked/full-text search and language analyzers;
- bulk/ensure/get-or-insert sugar;
- Store/Transaction `has`;
- collection-from-family, family enumeration, or family release;
- legacy Store snapshots/onChange/value enumeration; and
- migration of ShiftX's central entity/history/index system.

## Review log

- **Scope:** proceed with the unindexed vertical slice; reject indexes and
  artifacts from the first four-PR foundation.
- **API:** choose callable/readable collection with canonical-key-first
  generics; add missing contract coordinates before runtime export.
- **Kernel:** native row/tombstone/membership sources contribute through one
  optional domain-local extension to the existing TreeDraft commit phases;
  reject family-Atom, global plugins, and parallel mutation engines.
- **Ordering:** exact Map-like effective insertion order, with effective
  enabling sequence distinct from later value/ownership writes and deterministic
  Atom/row/membership source order.
- **Performance:** route only materialized collection history; atom-only path
  remains allocation-free and within existing gates.
- **Migration:** sessions first; defer central entity/history and indexes.
- **Evidence caveat:** ShiftX source snapshot is historical and incomplete;
  confirm current logout/persistence semantics before app landing.

## GSTACK REVIEW REPORT

| Review        | Trigger               | Why                             | Runs | Status | Findings                                     |
| ------------- | --------------------- | ------------------------------- | ---- | ------ | -------------------------------------------- |
| CEO Review    | `/plan-ceo-review`    | Scope & strategy                | 0    | —      | Not run                                      |
| Codex Review  | `/codex review`       | Independent 2nd opinion         | 0    | —      | Not run                                      |
| Eng Review    | `/plan-eng-review`    | Architecture & tests (required) | 2    | CLEAR  | 47 issues folded, 0 critical gaps            |
| Design Review | `/plan-design-review` | UI/UX gaps                      | 0    | —      | Not applicable to core runtime               |
| DX Review     | `/plan-devex-review`  | Developer experience gaps       | 0    | —      | API/DX compile probes included in Eng Review |

**VERDICT:** ENG CLEARED — T7 recorder and differential boundaries are locked.

NO UNRESOLVED DECISIONS
