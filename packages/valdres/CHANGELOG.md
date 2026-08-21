# valdres

## 1.0.0-beta.20

### Minor Changes

- [#327](https://github.com/eigilsagafos/valdres/pull/327)
  [`4a288d0`](https://github.com/eigilsagafos/valdres/commit/4a288d0cfefa37913cfa0474bfef4d721044c8c2)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Add
  `store.onDispose()` and `store.hasScope()`, and type `store.txn()`'s return
  value.

    **`onDispose(callback)`** runs when a store is disposed — `dispose()` on it,
    an ancestor disposed, or, for a scope, its LAST lease detaching — and
    returns a function that cancels the registration.

    ```ts
    const draft = root.scope(changeSetRef)
    draft.onDispose(() => cache.delete(changeSetRef))
    ```

    For resources a consumer owns alongside a store and must release with it: an
    adapter's per-scope cache, a subscription to something external, a timer. A
    scope's death was otherwise unobservable from a single lease — the holder
    knows when IT detaches, not whether it was the last — leaving inference on
    the next acquire as the only option, which cannot tell a scope that survived
    from a new one reusing the id, so state keyed by that id leaks into its
    successor.

    The store is already terminal inside the callback, so read what you need
    beforehand and close over it. Every callback runs even if an earlier one
    throws; the first error reaches whoever called `dispose()`. Per-atom setup
    still belongs in `onMount`, whose cleanup tracks subscribers rather than the
    store's lifetime.

    **`hasScope(scopeId)`** answers whether a store has that child scope — the
    same question `scope(scopeId, callback)` answers by throwing, without making
    a caller catch to find out. Depth composes through `scope()` rather than a
    path argument: `store.scope("a", s => s.hasScope("b"))`.
    `storeAdapter.hasScope` still works and now forwards to it.

    **`store.txn()`** returns its callback's value, which it always did at
    runtime while being typed `void`. The two other callback forms —
    `store.scope(id, cb)` and `txn.scope(id, cb)` — are both typed
    `=> ReturnType<Callback>`, so this was an inconsistency rather than a
    decision, and consumers were casting. Widening `void` to the callback's
    return type is not a breaking change.

    Also documents a scope-local `del()`, whose two read paths differ on
    purpose: `get(family)` omits the member while `get(family(key))` still
    returns the parent's value, because a value read with no local value falls
    through the scope chain as always. The scope said "not one of mine", not
    "gone everywhere".

## 1.0.0-beta.19

### Minor Changes

- [#324](https://github.com/eigilsagafos/valdres/pull/324)
  [`63d9ca3`](https://github.com/eigilsagafos/valdres/commit/63d9ca3a5f710b586ffbd59d1d92ca7768f8b7da)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Add
  `ScopedStore.unsetAll()` — drop every value a scope owns so it reverts
  wholesale to what it inherits, without destroying the scope.

    `unset(atom)` already drops one shadowed value so the atom re-inherits its
    parent's and resumes tracking it. `unsetAll()` is that for the whole scope,
    in a single commit:

    ```ts
    const draft = root.scope("draft")
    draft.set(title, "Draft title")
    draft.set(entity("draft-only"), "only in the draft")

    draft.unsetAll()

    draft.get(title) // the root's title again — and tracking it
    draft.get(entity) // the root's members again
    ```

    Atom-family membership reverts in both directions: members the scope added
    leave its `get(family)`, and members it deleted with `del()` come back.
    Every atom the scope shadowed notifies, exactly as `unset` does — including
    one whose inherited value is equal, since the scope genuinely stopped owning
    it. Atoms it never shadowed are untouched.

    The scope itself survives: id, leases, subscriptions, and nested scopes all
    keep working, and it shadows again on the next write. That is the difference
    from `detach()`, which releases a lease and destroys the scope with the last
    one — so this is the operation for a scope whose edits have been applied or
    abandoned while the scope stays on screen. Reverting also releases the atoms
    a long-lived scope would otherwise pin for the store's lifetime.

    Inside a transaction it stages rather than commits, so a scope can be
    reverted atomically with the writes that supersede it — from the scope's own
    transaction, or from the parent's:

    ```ts
    draft.txn(txn => txn.unsetAll())

    root.txn(txn => {
        txn.set(published, draftContent)
        txn.scope("draft", scoped => scoped.unsetAll())
    })
    ```

    `unsetAll()` is a scope operation — a root store has no parent to revert to
    — and the types say so: it is on `ScopedStore`, not `Store`, and on the new
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
    existing `(store: Omit<Store, "dispose">) => ...` and
    `(txn: Transaction) => ...` callback still assigns.

### Patch Changes

- [#324](https://github.com/eigilsagafos/valdres/pull/324)
  [`63d9ca3`](https://github.com/eigilsagafos/valdres/commit/63d9ca3a5f710b586ffbd59d1d92ca7768f8b7da)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix a scope's cold
  selector caches surviving `unset`.

    A cold selector — one with no subscriber and no live dependent — is not
    recomputed by propagation. It holds a cached value plus a snapshot of its
    dependencies' revisions, and revalidates against those on the next read.

    `unset` is the one write that REMOVES a store's own value instead of
    replacing it, and it recorded its revision bump on the store that no longer
    holds the value. Reads then resolve the revision through the parent chain
    instead, where nothing changed — so the snapshot matched, the cache
    validated, and the selector served its pre-unset value for the life of the
    scope:

    ```ts
    const derived = selector(get => `d:${get(source)}`)
    const draft = root.scope("draft")

    draft.set(source, "draft")
    draft.get(derived) // "d:draft"

    draft.unset(source)
    draft.get(derived) // was "d:draft" — now "d:root"
    ```

    A store's effective revision for a state it does not own is now the later of
    its own recorded revision and the inherited one, so the removal outranks the
    unchanged ancestor revision until an ancestor write overtakes it.

    Only ever affected cold selectors in a SCOPE: live selectors are recomputed
    by propagation, and on a root store the revision is read from the same place
    it was written. Reached through `store.unset`, `txn.unset`, and — across
    every value the scope owns at once — `ScopedStore.unsetAll()`.

## 1.0.0-beta.18

### Minor Changes

- [#320](https://github.com/eigilsagafos/valdres/pull/320)
  [`f4affba`](https://github.com/eigilsagafos/valdres/commit/f4affba65bb32429e2550aed63b51114ecaa434e)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Replace the
  `{ global: true }` atom/atomFamily flag with dedicated
  `globalAtom(defaultValue, options)` and
  `globalAtomFamily(defaultValue, options)` constructors.

    **Breaking.** `global` is no longer a key of
    `AtomOptions`/`AtomFamilyOptions` — `atom()` and `atomFamily()` only ever
    produce ordinary, per-store state now. Global (cross-store) atoms and
    families are created through the new constructors instead, with the same
    call shape as `atom()`/`atomFamily()` except `options.name` is required (it
    was previously optional, and plain global atoms could be unnamed). `atom()`
    no longer statically imports the global-atom engine module, shrinking the
    bundle for consumers who never create a global atom.

    Migration:

    ```diff
    -const config = atom(0, { global: true, name: "app/config" })
    +const config = globalAtom(0, { name: "app/config" })

    -const itemById = atomFamily(null, { global: true, name: "items" })
    +const itemById = globalAtomFamily(null, { name: "items" })
    ```

    The returned `GlobalAtom`/`GlobalAtomFamily` types, and their `getSelf` /
    `setSelf` / `resetSelf` surface, are unchanged. The exported
    `GlobalAtomOptions` / `GlobalAtomFamilyOptions` types are identical to
    `AtomOptions`/`AtomFamilyOptions`, except `name` is required instead of
    optional.

- [#300](https://github.com/eigilsagafos/valdres/pull/300)
  [`32b1894`](https://github.com/eigilsagafos/valdres/commit/32b18943331cbf0fd420181eb3920a8fb611d940)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Give every type
  reachable from an exported signature a name consumers can import.
  `AtomOptions`, `SelectorOptions`, `StoreOptions`, `AtomDefaultValue`,
  `AtomFamilyAtom`, `AtomFamilyDefaultValue`, `AtomFamilySelector`,
  `GlobalAtomFamily`, `EqualFunc`, `AtomOnMount`, `AtomOnSet`, `SubscribeFn`,
  `ScopedStore`, and `ScopeFn` are now exported from the package root, so a
  typed wrapper can annotate them directly instead of re-deriving private shapes
  with `Parameters`/`ReturnType`.

    `StoreOptions` is the full `store()` bag — including `id` and
    `batchUpdates`, which now carries doc comments describing the
    tick-coalescing commit and its scope-sharing semantics.

    `AtomOnMount` is properly typed:
    `(store: Store, state: Atom<Value> | Selector<Value>)` instead of
    `(store?: any, state?: any)`, so hooks that use their arguments get real
    types. Hooks that ignore the arguments — the common
    `onMount: () => bootstrap(thisAtom)` shape — are unaffected. A second type
    parameter narrows the state at the use site when a hook needs fields only
    one side has: `AtomOnMount<number, Atom<number>>` reaches `defaultValue`
    without narrowing, and still assigns into `atom()`.

- [#299](https://github.com/eigilsagafos/valdres/pull/299)
  [`8416094`](https://github.com/eigilsagafos/valdres/commit/8416094d5edfe8dbce5b0e5966ceaeb7442cf118)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Export
  `SelectorEvaluationError` and `SelectorCircularDependencyError` from the
  package root so applications can distinguish selector failures with
  `instanceof`. Give every Valdres error class a stable `.name`, make empty
  selector-error traces safe to inspect, and standardize public native errors on
  the `valdres:` message prefix with state names where available.

- [#321](https://github.com/eigilsagafos/valdres/pull/321)
  [`492af67`](https://github.com/eigilsagafos/valdres/commit/492af67409130b347ca133198c9bd82e4256ae83)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Allow duplicate
  copies of the same known Valdres version to adopt one shared global runtime
  instead of throwing. The shared `globalStore`, backing store data, semantic
  side tables, lifecycle markers, generated store IDs, name indexes, and
  global-family registry now keep engine state unified across copies, including
  `instanceof`-based error control flow. Different or unknown versions fail with
  actionable guidance.

    Global atom families remain first-definition-wins singletons, but
    development builds now warn when a later default or options object is
    ignored, and detectable kind or `keyOf` contract mismatches throw.

- [#301](https://github.com/eigilsagafos/valdres/pull/301)
  [`2697ce5`](https://github.com/eigilsagafos/valdres/commit/2697ce5965b0f8f4f97ce0d9659a553ee2c8fa19)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Correct the public
  write and family contracts and prevent borrowed scope callbacks from disposing
  scopes owned by lease holders.

    `store.set` and transaction `set` now type synchronous writes as their value
    and Promise or promise-returning-updater writes as `Promise<Value>`.
    `selectorFamily` member getters receive the same `SelectorGetOptions` as
    plain selectors. Global atom families now require a stable `name` at compile
    time, matching their existing runtime requirement.

    The global-family overload correction is a breaking type change for callers
    that pass an options variable typed only as `AtomFamilyOptions`, where
    `global` is an unresolved `boolean`. Narrow `global` to a literal branch or
    pass a literal `{ global: true, name }` object so TypeScript can select the
    global return type. Plain global atoms still permit unnamed instances, and
    selectors do not expose a global option.

### Patch Changes

- [#304](https://github.com/eigilsagafos/valdres/pull/304)
  [`2539b82`](https://github.com/eigilsagafos/valdres/commit/2539b82d95c7f1329f17a9a2740eef5bbb5be690)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Ship ESM
  declarations with explicit `.js` import specifiers so package exports resolve
  for Node16 and NodeNext TypeScript consumers with library checking enabled.

- [#277](https://github.com/eigilsagafos/valdres/pull/277)
  [`fc0c8bb`](https://github.com/eigilsagafos/valdres/commit/fc0c8bbd3617ac73e7158af6638146ea1146cc61)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - A direct write to a
  global atom now builds six plan objects per commit instead of nine: the
  ordered global sets and the deferred onSet queue share one
  `[atom, value, origin]` descriptor and one queue rather than allocating a
  duplicate pair, since they describe the same write.

    `store.onCommitEnd` no longer fires for a commit that produced nothing. A
    transaction whose every write is value-equal, and a `reset` of an atom
    already holding its default, are now as silent as the no-op `set` and no-op
    `unset` already were. Real work performed inside such a commit — a
    subscriber or `onSet` hook writing during delivery — still coalesces into
    exactly one notification.

    Internally, the illegal `CommitPlan` states are now unrepresentable rather
    than merely unused: `beginCommit`/`endCommit` are one paired boundary
    capability, global fan-out exists only as part of a forest settlement,
    report preparation requires the report it prepares, and delete/unset work
    groups are non-empty or absent — which also removes an asymmetry where an
    empty `deleted` group counted as settlement work while an empty `unsetAtoms`
    group did not. Settlement work is evaluated once per commit instead of three
    times. The published bundle is unaffected by the accompanying engine
    self-checks: they are compiled out.

- [#295](https://github.com/eigilsagafos/valdres/pull/295)
  [`bf616d6`](https://github.com/eigilsagafos/valdres/commit/bf616d68642feccb7ca2e043f28cf60e8bf848af)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Stop dropping
  writes that the default equality check could not see. Values differing only in
  a symbol-keyed own enumerable property, in a property set beside the contents
  of an array, `Map` or `Set`, or in a property that a custom `valueOf` /
  `toString` does not expose all compared equal, so `set()` bailed as a no-op:
  the store kept the old value, no subscriber fired, and nothing warned.

    Own enumerable properties — symbol-keyed ones included — are now part of the
    comparison for plain objects, arrays (holes and expandos included), `Map`,
    `Set` and `RegExp`, and a custom `valueOf` / `toString` narrows the
    comparison instead of replacing it. Binary buffers and views still compare
    by their bytes alone, because enumerating a typed array's keys costs time
    proportional to its length.

    The identity and early-exit paths are unchanged; the added work is spent
    only once two distinct values have otherwise compared equal.

- [#305](https://github.com/eigilsagafos/valdres/pull/305)
  [`40a0998`](https://github.com/eigilsagafos/valdres/commit/40a0998a019653f3a94fd310b8a143879ecae5b7)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix published
  metadata for CommonJS `require(esm)` and legacy TypeScript resolution, declare
  Node.js 22.12 or newer, and preserve Valdres's runtime duplicate-instance
  guard during tree-shaking.

- [#318](https://github.com/eigilsagafos/valdres/pull/318)
  [`8b3903b`](https://github.com/eigilsagafos/valdres/commit/8b3903b659fd5a8d8fd3e22fa48e1857119ed531)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Improve core write,
  propagation, store, and family-key hot paths. Commit plans now share one
  complete object shape, scheduler metadata uses bitwise decoding, root and
  scoped stores initialize one stable set of fields, and primitive family keys
  avoid allocating a cycle guard.

- [#288](https://github.com/eigilsagafos/valdres/pull/288)
  [`f16ed4e`](https://github.com/eigilsagafos/valdres/commit/f16ed4e65bf5d2ab2f05fdf19ec8cb51a223814f)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix `writeAtoms` so
  an equal-value transaction write is a true no-op on a root store: it no longer
  overwrites the stored reference with the new (deep-equal) value, and no longer
  bumps the tree revision or invalidates cold selector caches. The scope-shadow
  pinning behavior on scoped stores is unchanged.

- [#294](https://github.com/eigilsagafos/valdres/pull/294)
  [`82ff384`](https://github.com/eigilsagafos/valdres/commit/82ff3848fbc754e2c707bf4c5f904ebce775585b)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Keep synchronous
  reads fresh across scoped stores when `batchUpdates` is enabled. Implicit
  batched transactions now share the explicit transaction tree, so descendant
  reads and derived writes see pending ancestor values while preserving child
  shadows and deferred notifications. Disposing one scope drops only that
  scope's pending branch, and synchronous descendant operations flush the
  ancestor batch before running.

- [#290](https://github.com/eigilsagafos/valdres/pull/290)
  [`1be55cf`](https://github.com/eigilsagafos/valdres/commit/1be55cf3672aa70b50ecca01cd47d6450a0ab2e1)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix
  `store.onCommitEnd` delivery for transactions that initialize a large batch of
  fresh, otherwise unobserved atoms. These commits now report their completed
  work even when run without another global store listener already active.

- [#264](https://github.com/eigilsagafos/valdres/pull/264)
  [`422a7d4`](https://github.com/eigilsagafos/valdres/commit/422a7d410474c1bd8a232ceb99dd545c9d4e6a75)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Global writes,
  resets, async settlement, max-age revalidation, and `resetSelf` now execute
  through one CommitPlan forest. Each affected physical store is visited once
  with the union of its local, inherited, shadow, and global trigger groups,
  reducing repeated selector evaluation and custom-equality work while
  preserving peer-before-origin observers, reports, cleanup, and first-error
  ordering.

- [#265](https://github.com/eigilsagafos/valdres/pull/265)
  [`b394e0f`](https://github.com/eigilsagafos/valdres/commit/b394e0f1a2e51456d0f30aa73cf1372892785d47)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Move every write to
  the dependency-graph tables behind an internal GraphRuntime boundary
  (`src/lib/graph/`): forward/reverse edges and dependency replacement,
  scope-branch registration, liveness counters and mount reachability, cycle
  metadata, orphan-edge cleanup, and the installation of dependencies discovered
  by async evaluation. Selector evaluators no longer mutate graph state — they
  report discovered dependencies through a pooled evaluation-outcome carrier and
  the dispatcher that ran them installs the result, so evaluation and graph
  bookkeeping are now separable phases with documented invariants at each
  boundary.

    Internal-only: no public API, semantics, or ordering changes. The core
    write-path import cycle shrinks from 24 modules to 9 and the
    `mountAtom ↔ storeFromStoreData` cycle is gone, guarded by a new
    type-checker-based table-ownership scan and stricter import-boundary tests
    alongside the existing cycle ratchet.

- [#261](https://github.com/eigilsagafos/valdres/pull/261)
  [`c4c2e6c`](https://github.com/eigilsagafos/valdres/commit/c4c2e6ce94c57b87bb2af3377ec3feb68f7f7f78)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Transaction staging
  now lives in a dedicated MutationDraft write overlay, and every single-store
  transaction commit executes through the shared CommitPlan engine. Two
  deliberate edge-case fixes ride along: (1) when reporting an unset during a
  transaction commit itself fails (for example a throwing function default
  evaluated by the report's parent read-through), the first captured commit
  error — such as an earlier onSet hook error — now surfaces instead of being
  masked by the reporting failure; (2) transaction staging now validates schemas
  before dev-freezing, so validators observe the same (unfrozen) value
  representation as direct writes.

- [#298](https://github.com/eigilsagafos/valdres/pull/298)
  [`539fb74`](https://github.com/eigilsagafos/valdres/commit/539fb742cc4ffaf22f64939733c1c2bb373262ba)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Hide engine-only
  `__` fields from the public `Atom`, `Selector`, `AtomFamily`, and
  `SelectorFamily` types. The undocumented `globalStore.atoms` and
  `globalStore.atomFamilies` registries are also no longer exposed; global atom
  families retain the same process-wide identity through module-private state.

- [#302](https://github.com/eigilsagafos/valdres/pull/302)
  [`b669d77`](https://github.com/eigilsagafos/valdres/commit/b669d77e9637a089ff96da8994cc38ae43ed7360)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make direct
  (non-transaction) `atomFamily` membership changes scale linearly. Every
  `store.set(family(id), …)` on a NEW member — and every `store.del(member)` —
  rebuilt and re-sorted the family's entire membership snapshot, so the cost of
  adding member K was proportional to the K-1 already there. A loop of 4,000
  direct creates took ~1.1s (~540× the same work in one transaction) and grew
  ~O(K² log K).

    The direct path now defers rendering the same way a transaction always has:
    a membership write publishes the live index and materializes the sorted,
    frozen array at the first observation boundary — a read of the family
    through `store.get`, a selector, or dehydration. Deleting a member also
    drops its creation entry instead of shadowing it with a tombstone, so a
    render walks one entry per deleted member instead of two; the tombstone
    stays (it masks an inherited member and stops a read from resurrecting it),
    so a render remains proportional to live members plus everything the index
    has ever deleted.

    Measured with the same benchmark on both sides: direct set of 500 new
    members 15.0ms → 312µs (~48×), and a direct create-then-delete cycle of 500
    members 34.5ms → 403µs (~86×) — both now in the same range as Jotai's
    nearest equivalents (280µs / 347µs), where they were 50× behind. Transaction
    throughput, atom/selector read and write paths, and membership semantics are
    unchanged.

- [#287](https://github.com/eigilsagafos/valdres/pull/287)
  [`c1a58bc`](https://github.com/eigilsagafos/valdres/commit/c1a58bc9174210e359f26202fc3fadc12bb6d514)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Publish a minified
  `dist`, and stop paying for benchmark-only counters in production.

    The build now minifies. Most consumers bundle valdres and would minify it
    themselves, so the headline win is in the published package — `dist`
    JavaScript drops from 53.2 KB to 36.3 KB gzip (−32%) and the packed tarball
    from 111.8 KB to 96.9 KB gzip (−13%), which every install and every
    CDN/unpkg fetch pays. Consumer bundles also shrink slightly (≈0.9%, e.g. the
    `atom + selector + store` fixture 30,462 → 30,079 bytes gzip) because
    mangling valdres's internals here beats what a bundler infers through the
    module graph. Source maps are deliberately not shipped: they restore
    readable stack traces through valdres internals but measured at +167% on the
    packed tarball (97 KB → 299 KB gzip), which is the wrong default when only a
    rare consumer steps through our internals.

    Two `architectureInstrumentation` call sites were reachable in production
    without an `IS_PROD` guard — `recordCommitPlanRun` in the commit engine
    (once per commit, the hottest path in the engine) and the scheduler/liveness
    allocation counters in the graph workspace pool. Both now sit behind
    `!IS_PROD`, matching every other `record*` call site, so a production build
    pays neither the call nor the `data.architectureInstrumentation` load. These
    are test/benchmark-only structural counters that production code has no way
    to enable, so no observable behavior changes.

    The build-output tests now assert the `process.env.NODE_ENV` and engine
    self-check contracts against the minified artifact that actually ships, with
    structural chunk-placement assertions kept on an unminified build where
    identifiers survive.

- [#274](https://github.com/eigilsagafos/valdres/pull/274)
  [`154b413`](https://github.com/eigilsagafos/valdres/commit/154b413f4b06ea939d7b0cbfbba34cb2d5de34db)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Single-store
  transactions that mix ordinary writes with `del` / `unset` now settle through
  the same commit forest as cross-scope and global-peer commits. Previously they
  ran up to three sequential passes over the same store — update, then delete,
  then unset — so a selector reached by more than one of them was evaluated once
  per pass. The store is now visited once against the union of its trigger
  groups.

    Three observable behaviors are corrected as a result:

    - **A throwing unset report no longer starves the rest of the commit.**
      Filling an `unset` change record can evaluate user code (a scope reads
      through to a de-materialized parent's lazy default). That report now runs
      inside the settlement walk's reporting phase, so a throw is recorded into
      the commit's error arbitration instead of escaping: selector settlement,
      subscriber delivery, `onChange`, and scope re-delegation all still
      complete, and the first error captured by the commit is the one rethrown.
      Previously the throw skipped the shared deferred notification —
      subscribers never fired for writes that `onChange` had already reported —
      and left a scope with a dropped parent delegate, silently ignoring later
      parent writes.
    - **A mixed update + family delete reports its selector's final value
      once.** The spanning selector is evaluated a single time, on fully-applied
      state, and reported from the trigger group that first reached it. Record
      content and order are unchanged (atoms, then the selectors that group
      reached, in group order); only the redundant re-evaluation is gone.
    - **A scoped transaction's `unset` reports its recomputed selectors.** The
      parent value is now materialized by the selector's own read-through during
      settlement rather than by a pre-settlement report pass, so a selector that
      genuinely changed is emitted as part of the commit instead of being
      consumed by a silent parent cascade.

    `store.unset()` is not a transaction and is unchanged.

- [#276](https://github.com/eigilsagafos/valdres/pull/276)
  [`02e65c7`](https://github.com/eigilsagafos/valdres/commit/02e65c75328d88947e314933ca211c3da4dec9b7)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix `unset`/`reset`
  stranding a suspense placeholder on an atom with no default.

    Reading an atom declared without a default (`atom<T>()`) hands the caller a
    pending placeholder promise, resolved by the next write. Removing the
    store's own value while that placeholder was live — `store.unset(atom)`, or
    `store.reset(atom)` on a no-default atom — left the entry in place, and the
    re-initialization on the next read minted a **second** placeholder over the
    same key. Only the new one was ever resolved, so a consumer already
    suspended on the first (`await store.get(atom)`, or a Suspense boundary)
    hung forever:

    ```ts
    const a = atom<number>()
    const suspense = store.get(a)
    store.unset(a)
    store.set(a, 7) // resolved a different placeholder
    await suspense // hung
    ```

    Re-initialization now reuses the outstanding placeholder, so the suspended
    reader is the one a later write resolves.

- [#306](https://github.com/eigilsagafos/valdres/pull/306)
  [`826fff9`](https://github.com/eigilsagafos/valdres/commit/826fff9d691bb3798504593abb03c6639580e4d0)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Default
  process-less CDN and edge runtimes to production mode so accepted writes skip
  development-only deep-freezing, validation diagnostics, warnings, and
  instrumentation. To retain those checks while debugging a process-less
  runtime, bundlers can enable the `development` export condition; no-build CDN
  consumers can load the development dist entry directly. The condition must be
  applied consistently when framework adapters are present. Environments with
  `process.env` continue to honor `NODE_ENV`.

- [#297](https://github.com/eigilsagafos/valdres/pull/297)
  [`0b3fb58`](https://github.com/eigilsagafos/valdres/commit/0b3fb58ad8dfc2a88dacddade17ee03a8177cdb9)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Reject
  non-JSON-safe atomFamily args in `dehydrate` (dev builds). Family args cross
  the wire raw — schemas encode member values, not keys — and `hydrate`
  re-derives each member with `family(...args)` from the parsed payload. A
  `Date`, `Map`, `Set`, `BigInt`, `NaN`, `-0` or `undefined` argument does not
  survive that round-trip, so the entry silently hydrated onto a phantom member
  (or made `JSON.stringify` throw). Containers are checked by their own keys too
  — a `toJSON` hook, an array expando, or a symbol-keyed property changes the
  parsed result just as surely. Dev-mode `dehydrate` now throws a `TypeError`
  naming the family and the argument path, e.g. `args[1].at[0] is a Date`.
  Production behaviour is unchanged.

- [#293](https://github.com/eigilsagafos/valdres/pull/293)
  [`7d135d7`](https://github.com/eigilsagafos/valdres/commit/7d135d74e89e74b168459de6c08e417a2db2ce75)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Prevent rejected
  async atom writes from restoring a settled Promise without a live settlement
  coordinator. Promise fallbacks from earlier writes, async function or selector
  defaults, and parent scopes now converge to a settled atom value, including
  for dependent selectors, without retaining completed coordinator chains.

- [#266](https://github.com/eigilsagafos/valdres/pull/266)
  [`f672be4`](https://github.com/eigilsagafos/valdres/commit/f672be49cd3cfc2fd0e0b8ae069d8c46f34dcb94)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Reuse bounded,
  frame-local graph worklists for selector scheduling and exact cyclic-liveness
  reconciliation. A changed-seed closure scheduler evaluates ordinary acyclic
  selectors once against finalized upstream values while no-op multi-seed writes
  stop before downstream discovery. Dynamic dependency replacement, re-entrant
  writes, and convergent cyclic fallback behavior remain supported.

- [#260](https://github.com/eigilsagafos/valdres/pull/260)
  [`756fd96`](https://github.com/eigilsagafos/valdres/commit/756fd96a31119c72ae4eb69d3b3ca35e1efc8bbc)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Async atom
  settlements no longer take the heavier observer propagation and reporting path
  when the only `onChange` or `onCommitEnd` listeners are attached to unrelated
  store trees. An otherwise unobserved async atom now settles on the lightweight
  path, while listeners on the affected store tree still select the observer
  path as before.

- [#267](https://github.com/eigilsagafos/valdres/pull/267)
  [`84d73fc`](https://github.com/eigilsagafos/valdres/commit/84d73fcf6083cd39dfc914b0f2b89328d4ceff7e)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - A throw during
  commit-forest settlement collection no longer leaves the commit depth above
  zero, which previously silenced all future `onCommitEnd` delivery. Multi-root
  commit boundaries now close even when an earlier root or listener throws, and
  the first error thrown is still the one propagated.

- [#263](https://github.com/eigilsagafos/valdres/pull/263)
  [`dddcafd`](https://github.com/eigilsagafos/valdres/commit/dddcafd33a35e7d14934dfb508bbbf4a583922bb)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Cross-scope
  transaction commits now execute one tree-level CommitPlan that settles each
  affected store exactly once against the union of its own writes, inherited
  changes, and any folded global-peer updates. Observable deltas: a selector
  spanning several scopes evaluates once per store per commit instead of once
  per reaching pass (an async spanning selector creates one promise per commit
  instead of two); a custom `equal` receives the same per-reaching-pass trigger
  sets as before — consulted in reaching order for exactly the groups whose
  dirty chain reached that selector — so an impure predicate counting calls sees
  fewer of them; a global peer that is itself part of the transaction's store
  tree settles once instead of once in the peer pass and again in the tree; and
  an unset-report failure during a cross-scope commit records into first-error
  commit arbitration (and no longer starves other stores' settlement) instead of
  escaping raw. Subscriber delivery order, first-error arbitration, and onChange
  payload order keep their historical per-reaching- group causal positions.

- [#289](https://github.com/eigilsagafos/valdres/pull/289)
  [`348aa80`](https://github.com/eigilsagafos/valdres/commit/348aa80c882ef3f566f800d2c1ea950af28e8814)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix stale selector
  reads across transaction levels. A scoped transaction evaluates selectors
  through its parent's draft, but a write only marked its own level's cache
  dirty — so a root-level `set` left a scope (and a `parentScope` write left the
  scope that opened it) serving the pre-write value for the rest of the
  transaction. Writes now invalidate every selector cache in the working tree.

- [#292](https://github.com/eigilsagafos/valdres/pull/292)
  [`f8bf47e`](https://github.com/eigilsagafos/valdres/commit/f8bf47e829ec22e217f5d996dbb8d7bff3ad4af6)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix family-index
  membership for atoms lazily initialized inside a transaction. Reading an
  uninitialized family member with `txn.get(family(key))` wrote its default into
  committed store data but never registered the member in the family index, so
  the member held a value while being permanently absent from `get(family)`.

    A lazy init inside a transaction now produces exactly the observable result
    of the direct read it stands in for — membership, dependent-selector values,
    subscriber and `onCommitEnd` notifications, notification ORDER, and
    `onChange` (which stays silent for a lazy read, while real writes in the
    same transaction still report) — whilst coalescing into the transaction's
    single commit, so each observer fires at most once.

    This holds inside a scope too, where a `del` or `unset` of an inherited
    member touches no local value: the family index's tombstone, not a local
    cleanup set or the presence of a value further up the chain, decides whether
    a member survives.

    Membership is staged into the working index while the transaction is open,
    and the members no value-changing write carried are settled by the commit
    itself as a trigger group on its plan — one that counts as commit work even
    when it is the only group, so a lazy read of an already-registered member
    still notifies. Being part of the commit is what makes subscribers precede
    `onChange` and brings the engine's error continuation to bear: a throwing
    subscriber, hook, or `equal` can no longer leave a member holding a value
    with no membership, and the repair such a failure triggers neither
    resurrects a member the transaction deleted nor reports commit-end twice.
    Aborting settles the tree the same way — collected and marked terminal
    first, then settled behind one boundary with one notification phase, so no
    callback observes a half-settled tree or reaches a still-open context.

- [#303](https://github.com/eigilsagafos/valdres/pull/303)
  [`9123fef`](https://github.com/eigilsagafos/valdres/commit/9123fef350a0816a3073fa67e8a738616290b6be)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Stop
  `selectorFamily` from retaining every member it has created. Both the
  canonical key cache and string fast-path cache now hold selector identities
  weakly, so an unreferenced member and its captured arguments, getter, cached
  value, dependency graph, and encoded key can be reclaimed. Weakening and
  bounded-group finalizer registration are batched outside the synchronous
  creation path.

    Member identity remains stable while a caller or live store retains it. Once
    a member becomes unreachable, garbage collection may reclaim it and a later
    call may create a fresh identity. `release(...args)` remains available for
    explicit early cache eviction.

## 1.0.0-beta.17

### Minor Changes

- [#231](https://github.com/eigilsagafos/valdres/pull/231)
  [`888f868`](https://github.com/eigilsagafos/valdres/commit/888f868246adadac653517755c04821afc75d5cd)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Add
  `store.dispose()` and make scoped-store `detach()` dispose the scope when its
  final consumer leaves. Stores now keep a lazy reverse index of only the global
  atoms they touch, allowing disposal in O(touched global atoms) while removing
  every strong global-atom registration, balancing global `onMount` and `maxAge`
  lifecycles, and keeping future global writes independent of completed
  SSR/request stores. Queued batched writes and async settlements are discarded
  once their source store is disposed.

    Global fan-out now identifies its origin by `StoreData` identity rather than
    a user-provided store id, so separately-created stores with duplicate ids
    still synchronize. The identity fast path also skips redundant validation
    and equality work for the already-written origin store.

    The process-wide `globalStore` now rejects disposal so it remains available
    as the synchronization anchor for global atoms created later.

- [#251](https://github.com/eigilsagafos/valdres/pull/251)
  [`d11de95`](https://github.com/eigilsagafos/valdres/commit/d11de95881d0548fbf47add4a942aecb8fef6b0c)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make Store runtimes
  opaque. Stores now expose stable public identity through `store.id` instead of
  publishing mutable `StoreData`; `StoreData` is no longer exported from
  `valdres`, and `onSet` receives the public Store facade. Framework and tooling
  adapters now use the capability-based, versioned
  `valdres/adapter-internals/v1` boundary, which keeps adapter lookups off atom
  get/set hot paths. Engine-only atom/global-atom synchronization fields and the
  `MaxAgeInterval` timer type are no longer part of the public type surface.

- [#242](https://github.com/eigilsagafos/valdres/pull/242)
  [`165cdc4`](https://github.com/eigilsagafos/valdres/commit/165cdc4346091f860c193a686f4ea55e1e955671)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make `store.txn`
  own its complete atomic lifecycle. Transaction callbacks now receive a
  restricted, type-only `Transaction` surface with no manual `commit()` or
  backing `data`; a thrown callback always discards staged writes. Captured
  operations reject use while the transaction is committing or after it closes.

    Move manually controlled transactions to the explicit
    `valdres/adapter-internals` boundary, and update the Jotai compatibility
    adapter to use that boundary while preserving its adapter-specific
    commit-on-error semantics.

### Patch Changes

- [#247](https://github.com/eigilsagafos/valdres/pull/247)
  [`c8faa24`](https://github.com/eigilsagafos/valdres/commit/c8faa244800025ddd1756c6a17386ef84906a25e)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Align the `Store`
  type contract with runtime behavior: `store.set()` now types its existing
  return value, while callback-form `scope()` exposes a borrowed store without
  `dispose()` or `detach()` lifecycle ownership. Correct subscription and
  transaction examples across the documentation.

- [#233](https://github.com/eigilsagafos/valdres/pull/233)
  [`ca00a89`](https://github.com/eigilsagafos/valdres/commit/ca00a896025a42bf31528e505234a7bb929f292c)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Treat successful
  async selector settlement as a commit. `onCommitEnd` now fires once after
  selector subscribers and `onChange`, while observer failures remain distinct
  from source-Promise rejection and are no longer swallowed.

- [#222](https://github.com/eigilsagafos/valdres/pull/222)
  [`9ba01a1`](https://github.com/eigilsagafos/valdres/commit/9ba01a10dc4350247dec174b2ea0bdf99ed72942)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Keep async selector
  dependency reconciliation isolated per evaluation when multiple selectors or
  stores return the same Promise. Dependency data now lives on the existing
  evaluation context instead of a Promise-keyed global WeakMap, preventing one
  resolution handler from removing another evaluation's real edge while also
  reducing async tracking overhead.

- [#229](https://github.com/eigilsagafos/valdres/pull/229)
  [`20b253f`](https://github.com/eigilsagafos/valdres/commit/20b253fe91007ae8961ecc423b2d27c9420c68c7)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make `atomFamily`
  and `selectorFamily` cache identity collision-free with a type- and
  arity-tagged canonical key codec. Raw strings no longer overlap serialized
  objects, Arrays, or Promise markers; a single Array argument remains distinct
  from multiple arguments; BigInt keys are supported; and Map, Set, and
  plain-object keys remain order-independent.

    Family keys now reject Symbols, functions, Promises, class instances,
    accessor properties, and cyclic structures with a descriptive `TypeError`
    instead of silently merging them or overflowing the stack. Both family APIs
    accept an optional typed `keyOf(...args)` option for deriving supported
    deterministic identity from those arguments.

    Structured member debug names now reuse the canonical key instead of running
    a second display-only serialization on cache misses. Primitive names remain
    concise.

- [#227](https://github.com/eigilsagafos/valdres/pull/227)
  [`967bb03`](https://github.com/eigilsagafos/valdres/commit/967bb038855fe0d032cf3bd6f7810ad952d75e30)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Keep selectors that
  are read without a live subscriber out of the strong reverse dependency graph.
  Cold selector caches now validate forward dependency revisions on demand and
  promote their dependency closure only when they become subscribed, so dropped
  cold selectors can be collected and unrelated atom writes remain constant-time
  regardless of prior cold reads.

- [#226](https://github.com/eigilsagafos/valdres/pull/226)
  [`cdcb6a2`](https://github.com/eigilsagafos/valdres/commit/cdcb6a2bdd615d7ba04e32f43c68ed1551276eec)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Roll back
  subscription and liveness state when `onMount` throws so a later subscription
  retries the mount. Keep orphaned selector graph and cache cleanup queued when
  lifecycle cleanup throws during unsubscribe.

- [#236](https://github.com/eigilsagafos/valdres/pull/236)
  [`9278b66`](https://github.com/eigilsagafos/valdres/commit/9278b6635ebde1df9f4320e474ce54b41a0a64d9)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Route direct atom
  resets through the shared transaction commit pipeline so hooks, global
  synchronization, and notifications match transactional resets.

- [#250](https://github.com/eigilsagafos/valdres/pull/250)
  [`2d31b16`](https://github.com/eigilsagafos/valdres/commit/2d31b162fd2875cbb264620d59ce01a925cc1794)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make
  `dehydrate(store)` proportional to that store's named state. Named atoms are
  indexed lazily per store, and named family entries now iterate the store's own
  family membership instead of the process-global registry and identity cache.

- [#230](https://github.com/eigilsagafos/valdres/pull/230)
  [`e584913`](https://github.com/eigilsagafos/valdres/commit/e5849132a360c6224fbc66ed1236ddfc3f1fdbcc)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make atom-family
  membership maintenance linear for repeated transaction and hydration writes by
  skipping value-only index churn, rendering dirty indices once, and batching
  hydrated members per family.

- [#253](https://github.com/eigilsagafos/valdres/pull/253)
  [`01529e5`](https://github.com/eigilsagafos/valdres/commit/01529e523bbf26df6e3c188c052c44ef64303ec8)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Update Jotai
  compatibility coverage to Jotai 2.20.2. Preserve dependency read order when
  mounting sibling atoms, and surface original atom-read errors from the Jotai
  adapter instead of Valdres diagnostic wrappers. Support Jotai's per-store
  `INTERNAL_onInit` hook for primitive atoms.

- [#237](https://github.com/eigilsagafos/valdres/pull/237)
  [`7a59614`](https://github.com/eigilsagafos/valdres/commit/7a596146a8cdf64907ceb45871a60c56fc0391aa)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix fresh atom
  subscriptions whose selector defaults initialize other atoms by finishing
  nested initialization through the normal init-only propagation path. Also
  register atom-family members initialized by their first subscription in the
  family index, matching initialization through `store.get`.

- [#240](https://github.com/eigilsagafos/valdres/pull/240)
  [`2556617`](https://github.com/eigilsagafos/valdres/commit/255661708bd27cad9581cf0e47c5c8610fc86c8b)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Return atom-family
  membership as cached, frozen, readonly snapshots and keep internal index
  metadata non-enumerable, preventing callers from corrupting later family
  reads.

- [#246](https://github.com/eigilsagafos/valdres/pull/246)
  [`27340c5`](https://github.com/eigilsagafos/valdres/commit/27340c5e250e0fdf313e670c506cd209b229b9d1)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Index active
  inherited dependencies by immediate scope branch so parent atom updates
  traverse only subtrees with affected selectors. The index follows dynamic
  dependency churn, nested atom shadows, `unset`, unsubscribe cleanup, and scope
  detach; atom-family membership inheritance remains branch-aware.

    Root atom-set latency with 10,000 idle scopes is now effectively flat
    against the no-scope path (~90ns in the Bun benchmark), instead of scaling
    into hundreds of microseconds by visiting every scope.

- [#234](https://github.com/eigilsagafos/valdres/pull/234)
  [`ebbaff5`](https://github.com/eigilsagafos/valdres/commit/ebbaff5ec885a82d45c01badabd2f89e430a1f5f)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Validate maxAge
  revalidation results against atom schemas, preserve the last valid cache value
  on validation failure, and suppress subscriber notifications for equal
  refreshes while updating freshness metadata.

- [#241](https://github.com/eigilsagafos/valdres/pull/241)
  [`8d882e0`](https://github.com/eigilsagafos/valdres/commit/8d882e0993aa3ed87a27840accb91d261d0f0244)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Keep root `unset()`
  lazy when `store.onChange` is active. Reporting an unset no longer evaluates a
  function or async default just to populate the event; a root unset omits
  `value` unless propagation already rematerialized it. Redux DevTools now
  removes cold root entries when that optional value is absent.

- [#248](https://github.com/eigilsagafos/valdres/pull/248)
  [`4648c40`](https://github.com/eigilsagafos/valdres/commit/4648c40c3ec3c6ab67b7d1d8b47f2b0a3762980e)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Maintain exported
  subscription equality metadata with an O(1) reference count so tearing down
  many subscriptions to the same state is linear instead of quadratic.

- [#235](https://github.com/eigilsagafos/valdres/pull/235)
  [`f0e657c`](https://github.com/eigilsagafos/valdres/commit/f0e657cc569b652ae3c27e5ad7c0a6f09e11543f)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Give every selector
  evaluation its own lazily-created abort signal. Selectors using default or
  rest option parameters now receive abortable signals, and a selector may
  switch from a synchronous result to an asynchronous result without being
  permanently classified as synchronous.

- [#220](https://github.com/eigilsagafos/valdres/pull/220)
  [`26064d2`](https://github.com/eigilsagafos/valdres/commit/26064d2945be405a6f3909445b1da72f2f6c7158)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Finish atom writes,
  `onSet` hooks, selector propagation, and subscriber notification across direct
  sets, transactions, scopes, and global stores before rethrowing the first hook
  error.

- [#249](https://github.com/eigilsagafos/valdres/pull/249)
  [`2100bb3`](https://github.com/eigilsagafos/valdres/commit/2100bb35c138e4b145938bfdd3630fcb3468e9c4)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make
  selector-family objects identity-cached factories rather than readable or
  subscribable store state. Remove the untyped O(K) family-key enumeration path,
  narrow family subscriptions to `atomFamily`, and reject invalid runtime
  subscriptions consistently.

    Align async construction with `selector()`: selector-family member getters
    must be synchronous functions, but may return Promises. Cache hits remain
    unchanged; the native-async guard runs only when a new member is created.

- [#243](https://github.com/eigilsagafos/valdres/pull/243)
  [`b7536ab`](https://github.com/eigilsagafos/valdres/commit/b7536ab3bf4e2face50dda54a232242dd87a02f0)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Compare
  ArrayBuffer, SharedArrayBuffer, DataView, and typed-array values by their
  visible bytes, fixing unequal buffers being treated as equal and DataView
  comparisons hanging.

    Development deep-freezing now rejects mutable built-ins and host objects
    with an actionable `{ mutable: true }` requirement instead of throwing
    native typed-array errors or leaving Map, Set, Date, and binary contents
    mutable behind a frozen facade. The explicit opt-out is available on atoms
    and selectors; Error objects and Promise handles remain supported.

- [#223](https://github.com/eigilsagafos/valdres/pull/223)
  [`eafa72c`](https://github.com/eigilsagafos/valdres/commit/eafa72c78d41b6fcc2ae321244fecb26209a1410)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Settle Promise-like
  atom writes consistently in direct, batched, and explicit transaction writes.
  Batched stores now replace the pending Promise with its validated resolved
  value, roll back rejected or invalid writes, ignore stale settlements, and
  notify subscribed selectors without leaving them in a retry loop.

- [#238](https://github.com/eigilsagafos/valdres/pull/238)
  [`b8a82e5`](https://github.com/eigilsagafos/valdres/commit/b8a82e512f446f5f80970573cb0a8986392ddcdf)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Finish propagating
  atom updates and family-member deletions through descendant scopes before
  invoking any store-tree subscribers. A throwing root subscriber can no longer
  interrupt propagation and leave a child selector stale; every affected store
  settles first, all collected subscribers are attempted, and the first callback
  error is rethrown after notification completes.

    Keep descendant selector-aware `onChange` listeners ordered after
    subscribers, and allocate deferred notification entries only for stores that
    actually have callbacks to dispatch.

- [#228](https://github.com/eigilsagafos/valdres/pull/228)
  [`8c2531c`](https://github.com/eigilsagafos/valdres/commit/8c2531cef47d199cdcdb163347498029ad4fab05)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Share one internal
  runtime across every store facade backed by the same `StoreData`. Scope
  handles now act as lightweight detach leases over shared operations, so
  batched functional updates compose correctly, synchronous operations flush the
  common pending transaction, subscriber notifications coalesce once per
  microtask, and `onMount` writes participate in the same batch.

- [#221](https://github.com/eigilsagafos/valdres/pull/221)
  [`2046b87`](https://github.com/eigilsagafos/valdres/commit/2046b87f254666909528912a2dade380bd16b864)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Preserve
  atom-family member identity when a member is deleted from one store or scope
  but remains in another. `store.del(member)` now removes only that store's
  membership instead of globally releasing the family's shared identity,
  matching transactional deletion and preventing two member objects for the same
  logical key.

    Atom-family identity caches now hold members weakly, so keeping identities
    stable across stores does not make the family retain every unused member
    forever. The legacy `atomFamily.release()` method is now a deprecated no-op:
    explicit eviction is unnecessary with the weak cache and could create a
    second live member for arguments whose original member is still retained by
    a store.

- [#244](https://github.com/eigilsagafos/valdres/pull/244)
  [`2d21f06`](https://github.com/eigilsagafos/valdres/commit/2d21f06a66277e760e65de57b3f8b528d3ed9cc6)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make
  `store.dispose()` terminal and comprehensive. Disposal now drains ordinary and
  delegated subscriptions, mounts and timers, change and commit listeners,
  pending batches, async selector work, descendant scopes, and global atom
  registrations while balancing shared lifecycle counters. Later operations
  throw `StoreDisposedError`, and stale cleanup handles remain idempotent.

- [#225](https://github.com/eigilsagafos/valdres/pull/225)
  [`5dcd530`](https://github.com/eigilsagafos/valdres/commit/5dcd5309381f4f78f87038bd638ee9b3ce22bc5e)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make transaction
  selector reads use the standard selector evaluation boundary, including schema
  validation, cycle detection, abort options, wrapped errors, and async
  dependency tracking. Keep selector bookkeeping isolated from committed store
  state, invalidate transaction selector caches for every write operation, and
  reject Promise-like transaction callbacks before automatic commit.

- [#252](https://github.com/eigilsagafos/valdres/pull/252)
  [`f092e71`](https://github.com/eigilsagafos/valdres/commit/f092e71eb3604c57552ced5058693766732330eb)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make `index()` term
  identity collision-safe and stop one-off queries from being retained for the
  lifetime of the index. Terms now use the same canonical key codec as atom and
  selector families, with a new `keyOf` option for unsupported or intentionally
  grouped terms. Cached term selectors are weakly held and their serialized keys
  are removed after collection.

    Document `index()` as a reactive family filter rather than a materialized
    database index: predicate work is incremental and unchanged results stop in
    O(1), but preserving its ordered array result requires an O(family size)
    walk when query membership changes.

## 1.0.0-beta.16

### Patch Changes

- [#218](https://github.com/eigilsagafos/valdres/pull/218)
  [`5f2497f`](https://github.com/eigilsagafos/valdres/commit/5f2497f801f55c73caae95b14aac878976d7ff04)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Prevent pending
  async selectors from recreating cache entries and dependency edges after their
  last subscriber unmounts. Queued orphan cleanup now revokes the evaluation
  while preserving the existing signal contract, and stale Promise resolution
  and suspension retries are ignored by the store.

## 1.0.0-beta.15

### Patch Changes

- [#217](https://github.com/eigilsagafos/valdres/pull/217)
  [`a378dbb`](https://github.com/eigilsagafos/valdres/commit/a378dbbb0a9236ac0035676b654a0d9c94f0ac7b)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make subscription
  teardown linear across shared selector graphs. Ordinary DAGs now skip cycle
  scans through a conservative closure marker, while orphaned selector cache and
  reverse-edge cleanup is batched once per microtask with shared visit state.
  Liveness reconciliation and `onUnmount` callbacks remain synchronous. The
  microtask boundary for internal graph/cache cleanup is intentional; public
  store operations flush pending cleanup before observing or mutating state.

- [#211](https://github.com/eigilsagafos/valdres/pull/211)
  [`d370f16`](https://github.com/eigilsagafos/valdres/commit/d370f16b77d8f188fab6b2a740192dd57ae9e97e)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix
  `scope.set(atom, value)` silently failing to pin when `value` equals the value
  the scope currently inherits from its parent.

    A scope atom that hasn't been written yet is read through to a parent, so
    `setAtom` computed `currentValue` from that inherited value. When the new
    value was equal, it short-circuited (`if (areEqual) return`) _before_
    establishing the scope's own shadow — so the scope kept tracking the parent.
    A later parent write to that atom then leaked into the scope, silently
    dropping the explicit override (and a delegating subscription never
    re-rooted). The documented contract is the opposite: once a scope writes an
    atom it is isolated, and subsequent parent writes must not reach it.

    Concretely, this was wrong:

    ```ts
    const a = atom(2) // default 2
    const child = root.scope("draft")
    child.set(a, 2) // equals the inherited default → no shadow created
    root.set(a, 11)
    child.get(a) // returned 11; now correctly returns 2
    ```

    The cross-scope/transaction commit path (`writeAtoms`) already pinned equal
    values; only the individual `set()` path (`setAtom`) was missing it. The fix
    mirrors that branch: on a scope, an equal-valued set of a not-yet-shadowed
    atom now calls `setValueInData` to establish the shadow (registering it in
    `scopeValueIndex` and re-rooting delegating subscriptions) while skipping
    propagation, since the visible value is unchanged. On a root store, or when
    the scope already shadows the atom, the equal-value set remains a true
    no-op, so the write hot path is untouched.

- [#214](https://github.com/eigilsagafos/valdres/pull/214)
  [`1d7ef5d`](https://github.com/eigilsagafos/valdres/commit/1d7ef5db8666602820328bd5e38832142bbc466b)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix stable
  serialization for structured family keys that include Maps. Map family
  arguments no longer throw from an undefined serializer helper, and Map and Set
  arguments are serialized with stable tagged representations to avoid ordering
  instability and collisions with plain objects or arrays.

## 1.0.0-beta.14

### Patch Changes

- [#209](https://github.com/eigilsagafos/valdres/pull/209)
  [`c2f836f`](https://github.com/eigilsagafos/valdres/commit/c2f836fdf1fb33e72e2f20c49af0969e62c544a4)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Bound redundant
  selector re-evaluation for wide fan-in selectors under dynamic dependency
  churn.

    The downstream topological propagation walk now treats removal from its
    `pending` map as the settled marker, preventing dynamically changed
    dependency edges from repeatedly re-queueing an already finalized selector.
    When a graph mutation still requires a settled selector to be revisited,
    that selector and its downstream closure are deferred to the stranded settle
    phase, which now settles work in dependency order before falling back for
    cyclic regions. This preserves correctness for escaped/stranded
    dynamic-dependency cases while avoiding repeated evaluation of subscribed
    wide aggregators during transient settle waves.

- [#208](https://github.com/eigilsagafos/valdres/pull/208)
  [`7878dae`](https://github.com/eigilsagafos/valdres/commit/7878dae5dd2e2046893ef32a0f5094dd76d12baf)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make orphan
  selector dependency cleanup iterative so unsubscribing deep selector chains
  does not depend on JavaScript call-stack depth.

## 1.0.0-beta.13

### Patch Changes

- [#206](https://github.com/eigilsagafos/valdres/pull/206)
  [`b3db58b`](https://github.com/eigilsagafos/valdres/commit/b3db58b38f57adf2ab96a40e78ed7a17cefcc59b)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Clean up newly
  orphaned dependency selectors when the last subscriber to a leaf selector
  unsubscribes. Hidden subtrees now drop their cached selector values and
  reverse dependency edges instead of being re-evaluated on later upstream
  writes despite having no live consumer.

## 1.0.0-beta.12

### Patch Changes

- [#204](https://github.com/eigilsagafos/valdres/pull/204)
  [`3fc4fa3`](https://github.com/eigilsagafos/valdres/commit/3fc4fa331c58a513763497a8b49a7dd2655e0134)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Avoid redundant
  selector evaluations when an initial dirty selector is also downstream of
  another initial dirty selector in the same propagation pass. The initial dirty
  set is now ordered topologically when that subgraph is acyclic, and selectors
  scheduled later in that initial pass are not queued again for downstream
  propagation before they run. Cyclic initial regions keep the existing
  insertion-order behavior so dynamic dependency churn continues to use the
  established liveness reconciliation path.

## 1.0.0-beta.11

### Patch Changes

- [#202](https://github.com/eigilsagafos/valdres/pull/202)
  [`40fcdfc`](https://github.com/eigilsagafos/valdres/commit/40fcdfcfc97d4e25fa5c9ca2e82afab17f6801bf)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix a
  dependency-churn performance regression in the 1.0 liveness subsystem. The
  propagation rewrite made eval/propagation ~4× faster, but the new
  mount/unmount graph-walk (`mountTransitiveDeps` / `unmountOrphanedDeps`)
  walked the full transitive dependency subtree on every dependency edge a live
  selector gained or lost — even when nothing in that subtree had an `onMount`
  hook. On churn-heavy workloads (e.g. collapsing a deep decision tree that
  re-points thousands of layout dependencies) those walks dominated, erasing the
  rewrite's gain and then some.

    Each state now caches whether its downward dependency closure contains any
    mountable (`onMount` / `__valdresOnMount`) state, in a per-store
    `mountInClosure` marker. When a state's closure is mount-free — the common
    case for derived/layout selectors — the mount and unmount walks return
    immediately, before any allocation or traversal. The marker is set and
    propagated up on every dependency-edge add (no false negatives: a reachable
    mount hook is always marked); edge removals need no maintenance (a
    stale-true marker only costs a redundant, self-clearing walk, never a missed
    mount), which keeps the fix off the cyclic-reconcile path. A standalone walk
    that finds its subtree mount-free clears the stale marker.

    Mounts and unmounts fire exactly as before through dependency cycles,
    scopes, global atoms, and async/late dependencies. This also pins down the
    long-standing `onMount` contract: a mount hook must be set before the
    atom/selector is first used in a store (at creation, or assigned afterward
    but before first use — as the Jotai adapter does). Assigning `onMount` after
    the state is already participating in a store was never a guaranteed pattern
    and is now documented as unsupported, which is what lets the marker be
    trusted on every path.

## 1.0.0-beta.10

### Patch Changes

- [#200](https://github.com/eigilsagafos/valdres/pull/200)
  [`2cf6f7f`](https://github.com/eigilsagafos/valdres/commit/2cf6f7f2c895a8fb5d55314162f20893da9cc040)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix a
  dependency-tracking bug where a selector that reads the **same dependency more
  than once in a single evaluation** could fail to drop a dependency it stopped
  reading.

    `evaluateSelector` detected dependency-set changes by comparing the previous
    dependency count to the number of `get(...)` calls this evaluation. Because
    that count included duplicate reads, a branch like
    `cond ? get(a) + get(b) : get(a) + get(a)` evaluated to the same count (2)
    as the previous `{a, b}` (2), so the removal of `b` went undetected —
    leaving a stale reverse-dependency edge (and an inflated live-dependent
    count) on `b`, so writes to `b` kept waking the selector.

    Dependencies read during an evaluation are now tracked in a `Set`, so
    change-detection compares deduplicated sizes and the stale edge is removed
    correctly. (Also removes the previous array→Set conversion.)

- [#200](https://github.com/eigilsagafos/valdres/pull/200)
  [`2cf6f7f`](https://github.com/eigilsagafos/valdres/commit/2cf6f7f2c895a8fb5d55314162f20893da9cc040)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix a
  `liveDependentCount` desync that could leave a selector permanently non-live —
  and therefore returning a stale value — even though a live subscriber still
  transitively reads it.

    During a selector-update propagation the topological scheduler can
    re-evaluate a selector more than once with transitional (non-final)
    dependency sets (a selector that is both in the initial dirty set and
    downstream of another, plus escaped/stranded re-evals). When a still-live
    selector _transiently_ dropped a dependency, the eager liveness bookkeeping
    ran `propagateNotLive` and tore down the `liveDependentCount` of an entire
    transitive subtree; when the dependency was re-added later in the same pass,
    the `isLive(selector)` guard was now false (the selector itself had been
    caught in that teardown), so the compensating `onLiveDependencyAdded` was
    skipped and the subtree was left with `liveDependentCount === undefined`.
    `propagateDirtySelectors` then skipped it on every later write, so it never
    recomputed and served its cached value forever.

    This surfaced in apps that drive a stable subscribed root selector over a
    dynamic, data-dependent selector graph and rewrite many atoms in one
    transaction (e.g. a time-travel/scrub feature that collapses a layout to
    empty and grows it back): after the round trip, deep changes stopped
    propagating to the root until an unrelated change re-rooted the graph. It is
    the liveness analog of the beta.4 escaped/stranded _value_-staleness
    regression — the value path was hardened in beta.5, but the liveness
    bookkeeping was not.

    The fix re-derives `liveDependentCount` from ground truth for exactly the
    affected region (the downward dependency closure of the deps removed during
    the pass) after propagation settles, robust to any intermediate
    re-evaluation order and to cycles (recursive `selectorFamily` members). It
    is gated on a dependency actually being removed from a live selector during
    the pass, so the steady-state propagation path is unchanged.

- [#200](https://github.com/eigilsagafos/valdres/pull/200)
  [`2cf6f7f`](https://github.com/eigilsagafos/valdres/commit/2cf6f7f2c895a8fb5d55314162f20893da9cc040)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix a family of
  `liveDependentCount` desyncs that left selectors mis-marked as live or
  non-live after dependency-graph churn — most visibly a UI freeze when a
  subscribed selector's transitive dependency stopped being re-evaluated, and a
  slow "leak" where a cyclic group of selectors stayed live after losing its
  only subscriber.

    The live-dependent count was maintained as an incremental reference count,
    which cannot collect cyclic selector groups (mutual references keep each
    other's count above zero) and was fragile to maintain across the many paths
    that mutate the dependency graph (a subscribe, an unsubscribe, a
    dependency-set change during propagation, or a selector re-materialized
    lazily through `get`). The symptoms: selectors transitively read by a live
    subscriber could be left non-live and stop recomputing (stale value), and
    cyclic groups could be left live forever.

    Liveness is now reconciled from ground-truth reachability (a fixpoint that
    is correct for cycles by construction) over exactly the region whose
    dependency set changed, at each of the events that can change liveness. The
    reported scrub freeze, recursive-selectorFamily cycles, direct self-cycles,
    throwing dependencies, and dynamic-dependency churn are all covered. No
    public API change.

## 1.0.0-beta.9

### Minor Changes

- [#195](https://github.com/eigilsagafos/valdres/pull/195)
  [`67536e7`](https://github.com/eigilsagafos/valdres/commit/67536e7f177d46278b7324a56b2eecf738b1c86f)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Add
  `applyInitialize(txn, initialize)` — the single place the adapter `initialize`
  contract is interpreted, so every framework adapter handles it identically.

    It runs the callback inside a transaction the caller opened and applies any
    returned `[atom, value]` pairs, guarding with `Array.isArray` rather than a
    truthiness check. This fixes a latent footgun: a single-expression callback
    like `txn => txn.set(atom, 1)` already writes through `txn.set` and _returns
    that call's value_ (e.g. a number), which the previous
    `if (pairs) setAtomPairs(...)` pattern fed back into `setAtomPairs`,
    throwing "is not iterable". A non-array return now correctly means "the
    callback wrote directly; nothing left to apply".

    `valdres-svelte`'s `setValdresContext` and `scope` now consume the helper
    (replacing the inline `if (pairs)` pattern), so the crash no longer occurs.
    `setAtomPairs` remains exported as the low-level primitive; its docs now
    point to `applyInitialize` and show the `Array.isArray` guard.

- [#188](https://github.com/eigilsagafos/valdres/pull/188)
  [`0b3dbb7`](https://github.com/eigilsagafos/valdres/commit/0b3dbb7214d640beac5c1aead9d89e45d732e4fd)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Core prerequisites
  for the 1.0 adapter rework: a named-state registry with serializable SSR state
  transfer, a commit-boundary hook, and the shared adapter-initialization
  contract.

    **Named-atom registry + `dehydrate`/`hydrate` (SSR state transfer).** Atoms
    and atomFamilies created with a `name` now auto-register in a global
    registry on the `globalThis.__valdres__` single-instance slot. Names are
    global addresses: creating a second atom or family under an
    already-registered name throws (namespace them like
    `"@valdres/<pkg>/<atom>"`). An atomFamily registers the FAMILY under its
    name — members never register individually and are addressed as
    `family(...args)`; global families keep their idempotent same-name →
    same-instance behavior; selectors never register. `dehydrate(store)` walks
    the registry (not the store) and returns a JSON-serializable
    `{ atoms: [name, value][], families: [name, args, value][] }` payload
    holding only state with an own value in that store (root stores only);
    pending-promise values are skipped with a dev warning.
    `hydrate(store, payload)` resolves names through the registry — family
    entries via `family(...args)` — and applies everything in one `store.txn`;
    unknown names warn and are skipped (an atom only registers when its defining
    module was imported, so code-split clients must load those modules before
    hydrating). hydrate composes with schema validation: when the hydrating
    store (or an atom) enables `schemaValidation`, every payload entry is
    validated against its atom's `schema` as it stages — by default a failure
    throws `SchemaValidationError` and aborts the whole hydration atomically;
    `hydrate(store, payload, { invalid: "skip" })` instead warns and drops just
    the failing entries.

    Atoms with a bidirectional schema (zod 4 — meaningfully `z.codec`) are
    **wire-encoded**: `dehydrate` runs the schema's encode direction to produce
    the JSON-safe value (BigInt → string, Date → ISO string, nested codecs
    included) and marks the entry; `hydrate` runs decode to restore the runtime
    value. JS-native values cross a plain-JSON wire with no custom serializer —
    give the atom a codec schema and it just works. Decode failures route
    through the same `invalid` policy; a one-way transform schema can't encode
    and falls back to the raw value with a dev warning; classic `parse`-only and
    Standard-Schema-only validators transfer raw values as before. To support
    codecs under validation, `validateSchema` now also accepts a value when the
    schema's encode direction validates it (a stored value is output-side;
    `parse` checks the wire side) — purely additive over the previous behavior.

    **`store.onCommitEnd(callback)`.** Subscribe to commit boundaries: fires
    exactly once per commit (set/reset/del/unset, async resolution, `store.txn`,
    batched flush), strictly after every subscriber callback and after
    `store.onChange`, and returns an unsubscribe function. No payload by design
    — it is the minimal signal an adapter needs to coalesce one commit's
    subscriber updates into a single framework batch. Listeners attach to the
    store TREE's root: a commit anywhere in the tree (root or any scope) fires
    them, and writes performed by subscribers during a commit fold into the
    outermost commit's single fire. With no listener registered, commits pay one
    counter read — no tracking, no allocation.

    **Shared `InitializeCallback` + `setAtomPairs`.** The
    `(txn: TransactionInterface) => void | [Atom<any>, any][]` initialization
    callback every adapter accepts is now defined and exported by core,
    alongside `setAtomPairs(set, pairs)` which applies returned pairs through
    `txn.set`. `Transaction.reset` is now generic, making `Transaction`
    structurally assignable to `TransactionInterface` (kills the adapters'
    `@ts-ignore`).

    **Breaking (pre-1.0):** duplicate names throw as described above, and the
    `globalThis.__valdres__` slot changed from a bare version string to
    `{ version, registry }` (the single-instance guard behaves as before, and a
    leftover string slot from an older build is still detected).

- [#70](https://github.com/eigilsagafos/valdres/pull/70)
  [`ce638b0`](https://github.com/eigilsagafos/valdres/commit/ce638b0ba3871b2ba1536589da482670822c3585)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Add opt-in runtime
  schema validation for atoms and selectors.

    Pass a `schema` to an atom, selector, or family. Any **Standard Schema**
    (https://standard-schema.dev — Zod 3.24+/4, Valibot, ArkType, …) works, as
    does any classic validator with a `parse(value)` method. The schema also
    drives type inference, so `atom(undefined, { schema: z.string() })` is typed
    as `Atom<string>` without a generic. The schema is readable back off any
    atom, selector, or family object via `.schema` (families expose it without
    materializing a member), so consumers like devtools or a sync layer can
    validate values against a state's declared shape.

    ```ts
    const user = atom(
        { name: "Ada", age: 36 },
        {
            schema: z.object({ name: z.string(), age: z.number().min(0) }),
        },
    )

    // validation is opt-in per store, off by default
    const s = store({ schemaValidation: true })
    s.set(user, { name: "Bob", age: -1 }) // throws SchemaValidationError
    ```

    Design:

    - **Opt-in, inherited like `enumerable`.** Off by default; enable per store
      with `store({ schemaValidation: true })`. Scopes inherit it from their
      parent, so it stays off the hot path for the common (production) case and
      serves as a development-time safety net. An individual atom/selector can
      override the store with its own `schemaValidation: true` (always validate
      a boundary atom, even in a store with validation off) or
      `schemaValidation: false` (exempt a hot one).
    - **Validate-only.** The schema runs purely for its rejecting side effect;
      the original value is stored unchanged. A store with validation on
      therefore stores the same value as one with it off — no dev/prod
      divergence. Note this means a transforming/coercing schema
      (`z.coerce.number()`, `z.string().trim()`, `z.string().default(...)`)
      validates but does **not** transform; avoid those here (the inferred type
      follows the schema's output while the stored value is the input).
    - **Validated at the write boundaries.** Atom init (static, function, async,
      and selector defaults), atom `set` (sync + async), selector evaluation
      (sync + async), deleted-family-member reads, and `store.txn()` —
      transaction writes validate at staging time, so an invalid value throws in
      the txn body and aborts the whole transaction (atomic). Batched stores
      validate too.
    - **Errors name the culprit.** Sync failures throw a `SchemaValidationError`
      (exported) that names the offending atom/selector and keeps the
      library-native error (e.g. a Zod `ZodError`) on `cause`, instead of a raw
      error from deep inside the store. Async failures (a promise resolving to
      an invalid value) can't be thrown to the caller, so they're reported via
      `console.error` and the invalid value is never committed.

    Known limitations:

    - A **promise set inside `store.txn()`** is stored as-is and not
      auto-resolved by the transaction (pre-existing behavior), so it is not
      validated on resolve. Validate before setting, or set outside a
      transaction.
    - An invalid **async default/selector** drops its value (so a re-read
      re-inits) — the same as a rejecting async default. Under React Suspense a
      component that keeps re-reading will re-init/re-fetch; validate at the
      data boundary rather than relying on async-default validation under
      Suspense.
    - Asynchronous schema validation (an async Standard Schema, or a Zod schema
      with an async refinement) is not supported on the synchronous validation
      path and surfaces as an error; use synchronous schemas.

### Patch Changes

- [#196](https://github.com/eigilsagafos/valdres/pull/196)
  [`a0c959a`](https://github.com/eigilsagafos/valdres/commit/a0c959a1d41bc7041a69c87c651a6e7f5587d9ca)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Snapshot the
  subscriber list at dispatch start on the immediate single-atom notify path,
  matching the React/Redux contract.

    Previously the non-batched single-atom fast path iterated the LIVE
    `data.subscriptions` set, so subscription churn from inside a subscriber's
    callback leaked into the in-flight dispatch: a listener subscribed during
    dispatch fired for the same change, and a listener unsubscribed mid-dispatch
    was order-dependently skipped. The list is now copied before firing
    (`[...subs]`), so it's fixed at dispatch start — a listener added during
    dispatch does not fire for the in-flight change (it fires on the next one),
    and a listener that was present at dispatch start still fires even if
    another subscriber removes it mid-dispatch.

    This is a correctness fix for direct `store.sub` users and any adapter that
    adds or removes subscriptions inside a callback. The React adapter is
    unaffected: `useSyncExternalStore` does its sub/unsub in React's commit
    phase, outside valdres's dispatch. The copy happens only on the path that
    handed `callSubscribers` a live set and only when there are subscribers to
    fire; the deferred (multi-pass commit) and selector paths already accumulate
    into a fresh set and were already snapshotted.

- [#197](https://github.com/eigilsagafos/valdres/pull/197)
  [`4d57212`](https://github.com/eigilsagafos/valdres/commit/4d572129587e801ebea26c00f1e8f581b78f5035)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make
  `store.get(selector)` return a stable reference across repeated reads of a
  derived selector that has no live consumer (not subscribed, no live
  dependents). Previously the first read of such a selector returned a different
  reference than subsequent reads, even when nothing had changed — values were
  always correct, only reference identity was unstable while unsubscribed. This
  is what tripped React's "The result of getSnapshot should be cached to avoid
  an infinite loop" warning at initial mount, before `useSyncExternalStore`
  establishes its subscription.

    Root cause: a read that materializes new atoms runs an init-only propagation
    to register them. That pass walks the just-read selector's dependents and,
    for any selector with no live consumer, drops its freshly-computed cache
    "for lazy re-eval" — so the very next read re-evaluated and produced a new
    reference. The read path (`getDefault`) now restores the read selector's
    freshly-computed value after that pass, so repeated unsubscribed reads are
    reference-stable.

    The restore applies only to the selector being read. A selector reached
    merely transitively — e.g. one that read a family whose membership the read
    just changed — is still invalidated, so genuine staleness is picked up on
    its next read. A side benefit: a selector read without a subscription is now
    computed exactly once instead of twice (the init-time double-evaluation is
    gone).

- [#190](https://github.com/eigilsagafos/valdres/pull/190)
  [`59fab53`](https://github.com/eigilsagafos/valdres/commit/59fab53ed00b411ca3ad331f92f49c1c34fb7ae2)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Unnamed
  `atomFamily.name` / `selectorFamily.name` are now `undefined` instead of the
  intrinsic JS function names `"atomFamily"` / `"selectorFamily"`. Previously a
  family created without `{ name }` reported the declaring function's name, so
  consumers that use `name` as an identity/address (devtools, sync/persistence
  adapters) had to treat those literal strings as reserved "unnamed" sentinels.
  That heuristic broke under minification (bundlers mangle the intrinsic name,
  so an unnamed family slipped unnamed-detection in production builds) and
  wrongly flagged a family a user legitimately named `"atomFamily"` /
  `"selectorFamily"`.

    Unnamed families now mirror unnamed atoms/selectors (`atom()` / `selector()`
    without options have `name` undefined): `atomFamily(x).name === undefined`.
    A family explicitly named `"atomFamily"` keeps that name and is now
    distinguishable from an unnamed one. Named-family member naming
    (`name + "_" + key`) is unchanged.

## 1.0.0-beta.8

### Patch Changes

- [#185](https://github.com/eigilsagafos/valdres/pull/185)
  [`fbfb348`](https://github.com/eigilsagafos/valdres/commit/fbfb348412ecd3e1124cf1b6525fbda4dce1e219)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix two scope ×
  atom-family × transaction propagation-soundness bugs found by a differential
  soundness fuzzer.

    1. A parent family-member add never recomputed a scope's selectors that read
       `get(family)`. `propagateAtomUpdate` propagated only the changed member
       atoms into scopes, not the family object the selectors actually depend on
       — so the scope's `get(family)` membership refreshed but the dependent
       selector/`index()` stayed stale. The add path now propagates a family
       into scopes when its membership changes (a member added/removed); a pure
       value-update of an existing member still reaches scope selectors via the
       member atom, so it keeps the single-atom fast path. (Reproduces with a
       plain `set`, no transaction.)
    2. A scope whose family index was first materialized inside a transaction
       was severed from its parent index. `Transaction.cloneFamilyIntoTxn`
       flat-cloned the parent's rendered index into the scope's own `created`
       map and never registered the scope in `scopeValueIndex`, so later parent
       member adds never appeared in the scope and parent deletes never removed
       the inherited member. It now builds a proper child index
       (`createAtomFamilyIndex(parentIndex)`) and registers via
       `trackScopeValue`, exactly like the non-transaction `initFamilyIndex`
       path.

    The transaction family-index path now reuses the non-transaction
    `initFamilyIndex` chain walk (via a shared `ensureFamilyAncestorChain` run
    at commit) instead of authoring a flat index that could skip intermediate
    scopes. This consolidation also fixes a deeper-nesting case: a grandchild
    scope that first materialized its family index inside a scope-only
    transaction is now wired into the full ancestor `scopeValueIndex` chain, so
    later parent membership changes reach it.

    The core topological selector engine (`propagateDownstreamTopo` + liveness
    counting) was exercised by the same fuzzer across 30k+ random acyclic graphs
    with dynamic dependencies, scopes, and batched/cross-scope transactions with
    no soundness violations.

## 1.0.0-beta.7

### Minor Changes

- [#179](https://github.com/eigilsagafos/valdres/pull/179)
  [`231e59d`](https://github.com/eigilsagafos/valdres/commit/231e59d15dabb8fd822e0803e93ffad0f0d0138a)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - `store.onChange`
  can now also report **selector** (derived state) changes, gated by an options
  object, and the `StoreChange` shape is reworked around `type` + `state`.

    **Options — two independent toggles:**

    - `atoms` (default `true`) — atom `set` / `unset` / `delete` changes.
    - `selectors` (default `false`) — selectors that recomputed to a new value.

    ```ts
    store.onChange((changes, meta) => {
      for (const c of changes) {
        if (c.type === "selector") console.log("derived", c.state, "→", c.value)
        else if (c.kind === "delete") console.log("deleted", c.state)
        else console.log("atom", c.state, "→", c.value) // set | unset
      }
    }, { selectors: true })

    // selectors only:
    store.onChange(cs => …, { atoms: false, selectors: true })
    ```

    A `{ selectors: true }` listener additionally receives
    `{ type: "selector", state, value, scope }` for selectors that recomputed as
    a consequence of an operation — in the same single callback as the atom
    changes. Within a store's changes, atom entries precede that store's
    selector entries; descendant-scope recomputes carry their scope path.

    Only **live** selectors (those with a subscriber or a downstream dependent,
    i.e. already recomputed this pass) and only **genuine value changes**
    (respecting the selector's `equal`) are reported — so selector reporting
    forces no extra evaluation, and an orphaned selector whose cache is merely
    dropped is not reported. An async selector resolving surfaces as a
    `type: "selector"` change with `meta.source === "async-set"`. When no
    selector listener is active the propagation hot path is unchanged (gated on
    a global counter, no allocation).

    The callback's `changes` type follows the options: `AtomChange[]` by
    default, `StoreChange[]` with `{ selectors: true }`, `SelectorChange[]` with
    `{ atoms: false, selectors: true }`.

    **`StoreChange` shape.** `store.onChange` is unreleased, so this is its
    initial public shape (no migration from a prior release):

    - Each change has a `type` (`"atom" | "selector"`) and a `state` field — the
      changed atom or selector. (`state` matches valdres's `State` type and the
      `store.get`/`store.sub` parameter, so `store.get(change.state)` reads
      naturally.)
    - Atom changes carry a `kind`: `"set" | "unset" | "delete"`. Selector
      changes have **no `kind`** — a selector has no operation, only a
      recomputed value. Discriminate selector-vs-atom on `type`; switch on
      `kind` only after narrowing to `type: "atom"`.
    - New exported types: `AtomChange`, `SelectorChange` (with
      `StoreChange = AtomChange | SelectorChange`).

- [#177](https://github.com/eigilsagafos/valdres/pull/177)
  [`b76cdc2`](https://github.com/eigilsagafos/valdres/commit/b76cdc27414abf4c55bb6dfbc9c1c5d370af8f1d)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Add
  `store.unset(atom)` — drop a store's own value for an atom so it reverts to
  what it would otherwise read. The natural inverse of `set` (cf.
  `git config --unset`).

    - On a **scoped store**, the atom re-inherits its parent's current value.
    - On a **root store**, the atom reverts to its default; the stored value is
      removed (de-materialized) and re-initialized lazily on the next read —
      unlike `reset`, which eagerly writes the default back in.

    Previously there was no public way to do either: `reset` eagerly pins to the
    atom's default, and `del` removes a family member. `unset` fills the gap
    (notably for dev-tools time-travel, which needs to faithfully restore an
    override that was inherited at the target point).

    - `store.unset(atom)` removes the store's own value and all its bookkeeping
      (the value, any `maxAge` write timestamp, and on a scope the parent's
      `scopeValueIndex` entry + the scope's index keys), then notifies
      subscribers, dependent selectors, and nested scopes of the reverted value.
      Scope subscriptions resume tracking parent changes again.
    - No-op (no notification) when the store holds no own value for the atom.
    - Throws for non-atoms.
    - Surfaces on `store.onChange` as a new `kind: "unset"` change carrying the
      reverted value, tagged with the new `StoreChangeMeta.source` `"unset"` —
      so a consumer can tell the value was dropped (and decide whether to drop
      its own override or apply the reverted value) without overloading the
      `"set"` or `"delete"` kinds. The per-change `kind` is `"unset"` even
      inside a transaction (where `meta.source` is `"transaction"`), so an unset
      stays distinguishable from a set within a mixed transaction batch.
    - Transaction form: `txn.unset(atom)` (and
      `t.scope(id, st => st.unset(atom))`), collapsed into the transaction's
      single `onChange` callback. Within a transaction, a later `set`/`reset` of
      the same atom supersedes a buffered `unset` (and vice versa), and a
      mid-transaction read of an unset atom returns the reverted value
      (inherited on a scope, the default on a root).

- [#175](https://github.com/eigilsagafos/valdres/pull/175)
  [`2776bff`](https://github.com/eigilsagafos/valdres/commit/2776bffa8deee3f2bc651c757aa19e788339fbfc)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Add
  `store.onChange(callback)` — subscribe to every atom change in a store and its
  descendant scopes. Intended for dev tools and debugging.

    Emission happens at the propagation choke point (`propagateAtomUpdate` /
    `propagateDeletedAtoms`), so `onChange` mirrors what a subscriber would see
    — including changes that don't go through `set`/`txn`, such as **maxAge
    stale-while-revalidate refreshes** and **async default resolutions**.

    The callback receives `(changes, meta)`:

    - `changes` — an array of `StoreChange`, discriminated on `type`
      (`"atom" | "selector"`). Atom changes additionally carry a `kind`:
      `{ type: "atom", kind: "set", state, value, scope }` for a value change,
      `{ type: "atom", kind: "delete", state, scope }` for a family-atom
      deletion (`store.del` / `txn.del`, no `value`), or `kind: "unset"` when a
      store drops its own value. (Selector changes have no `kind` — see the
      selector-reporting changeset.) A direct `set`/`reset` (or an async atom
      resolving) delivers the change(s) from that operation; a transaction
      delivers a single callback with all of its changes.
    - `scope` — the chain of scope ids from the outermost scope down to where
      the change occurred (the ids you'd pass to `.scope()` to reach it), empty
      (`[]`) for a root store. Unambiguous for nested scopes that share a leaf
      name. A cross-scope transaction delivers one callback whose changes are
      individually scope-tagged.
    - `meta` — `{ source, name? }`. `source` is what produced the batch:
      `"set" | "reset" | "delete" | "transaction" | "revalidate" | "async-set"`.
      `store.txn(callback, name)` accepts an optional name, surfaced as
      `meta.name` alongside `source: "transaction"`.

    Internal valdres atoms (the cacheMeta atom backing
    maxAge/stale-while-revalidate) are excluded so dev tools aren't flooded with
    implementation-detail churn.

    Setting a **global atom inside a transaction** yields one callback per
    affected store: the origin store gets a single `"transaction"` callback, and
    each watched peer store gets a separate `"set"` callback (cross-store sync
    is a plain set on each peer, not part of the origin's transaction). The peer
    callbacks fire first, during the commit, before the origin's transaction
    callback.

    `onChange` returns an unsubscribe function. A global listener count gates
    every emit site, so when nothing anywhere is watching the propagation hot
    path does a single property read — no walk, no allocation.

- [#182](https://github.com/eigilsagafos/valdres/pull/182)
  [`68b124d`](https://github.com/eigilsagafos/valdres/commit/68b124d4f191431cd608ff04ba5c5fb15429f205)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Add
  `store.snapshot()` — enumerate a store's current materialized state, for a
  dev-tools consumer that connects after state already exists. Where
  `store.onChange` reports changes going forward, `snapshot()` lists what's
  there now: every set atom, every default-valued atom that's been read, every
  live (evaluated) selector, and every family member — across the root and all
  nested scopes.

    It's **opt-in at store creation**:

    ```ts
    const s = store(id, { enumerable: true })
    // or store({ enumerable: true })
    s.snapshot() // SnapshotEntry[]
    ```

    Each entry is `{ type: "atom" | "selector", state, value, scope }`, reusing
    `onChange`'s exact shape and filtering: internal (`__valdresInternal`)
    states (e.g. the cacheMeta atom) and family container objects are excluded,
    atoms vs selectors are classified via `isSelector`, and `scope` is the same
    id path from the outermost scope down (`[]` for the root).

    As part of this, the cacheMeta selector (the public counterpart to the
    internal maxAge/stale-while-revalidate cacheMeta atom) is now flagged
    `__valdresInternal`, so a _live_ cacheMeta selector is excluded from both
    `store.snapshot()` and `store.onChange({ selectors: true })` — matching the
    already-excluded cacheMeta atom.

    A store's values normally live in a `WeakMap`, so unreferenced
    atoms/selectors are garbage-collected and can't be enumerated retroactively.
    `{ enumerable: true }` switches that one structure to a `Map` (propagated to
    every nested scope), which retains entries for the store's lifetime — the
    deliberate cost of enumerability, fine for the dev/inspection context it's
    meant for. The mode is chosen once at creation, so the `get`/`set` hot paths
    are byte-identical to a default store and the default (WeakMap, GC-friendly)
    behavior is unchanged. Calling `snapshot()` on a default store returns `[]`
    and warns once.

### Patch Changes

- [#181](https://github.com/eigilsagafos/valdres/pull/181)
  [`affd12b`](https://github.com/eigilsagafos/valdres/commit/affd12b3845e355b71739cd7d577f5e2af5af74a)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix
  `store.del(familyMember)` (and `txn.del`) not re-evaluating dependent
  selectors in descendant scopes. When a family member was made live in both the
  root and a child scope — the scope inheriting the member rather than shadowing
  it — deleting it at the root fired the root's subscriber and updated the
  root's selector, but the child scope's subscriber never fired and its selector
  stayed stale.

    The delete-time scope cascade only re-evaluated scopes that _shadowed_ the
    family (keyed on `scopeValueIndex.get(family)`), so it missed two kinds of
    descendant dependent: a scope that merely inherits the deleted member and
    reads it directly (e.g. `get(family("a"))`), and a non-shadowing scope whose
    selector reads the family list (`get(family)`). `propagateDeletedAtoms` now
    cross-propagates the deleted member atoms _and_ their families through the
    full scope tree via the same `propagateToScopes` path the `set`/update flow
    already uses — members skip scopes that shadow them (their visible value is
    unchanged), families always propagate (their rendered list shrank
    everywhere) — so descendant-scope dependents re-evaluate and their
    subscribers fire, matching the update path.

- [#180](https://github.com/eigilsagafos/valdres/pull/180)
  [`4ccd1af`](https://github.com/eigilsagafos/valdres/commit/4ccd1af8b24c69f725677222d99d055421352822)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix `store.get()`
  on a deleted family member returning the default-value factory function
  instead of its resolved value. After `store.del(member)`, reading the member
  hit the deleted-in-family-index branch in `getState`, which returned the
  atom's raw `defaultValue`. For a family created with a function default
  (`atomFamily((id) => 0)`), member `defaultValue` is the factory itself, so the
  read yielded `[Function]` rather than `0` — and a selector reading it
  (`get(member) * 2`) produced `NaN`.

    The deleted-member read path now resolves the default the same way a fresh
    init does (suspend with a placeholder promise when there is no default, run
    a function default, evaluate a selector default, otherwise return the plain
    value) via a new `resolveAtomDefaultValue` helper, and caches the resolved
    default so repeated reads are stable (same reference) and never re-invoke a
    function/async factory — re-running it on every read would repeat its side
    effects (e.g. a `fetch`). For an async default the cached promise is swapped
    for its resolved value once it settles (mirroring `getAtomInitValue`), so
    later reads return the value rather than a forever-pending promise, and the
    resolved value is propagated to dependent selectors/subscribers (via a new
    `skipFamilyIndexUpdate` path in `propagateAtomUpdate`) so they react to it.
    The member still stays absent from `get(family)` — none of this re-registers
    (resurrects) it in the family index.

## 1.0.0-beta.6

### Patch Changes

- [#172](https://github.com/eigilsagafos/valdres/pull/172)
  [`6ad0ccc`](https://github.com/eigilsagafos/valdres/commit/6ad0ccc5b0a78968636c6f37a5552edc4685276f)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix stale
  cross-scope/cross-pass selectors and a related `index()` crash (regressions
  exposed by the beta.4 topological propagation and the beta.5 cross-scope
  atomic commit).

    **Stale selector across commit passes + non-atomic observation.** A
    cross-scope transaction (and the single-store update+delete transaction)
    propagates in one pass per store and shared a per-commit
    `evaluatedSelectors` dedup guard so a selector reachable by more than one
    pass evaluated once. That guard caused two correctness regressions — a
    selector (and its whole subtree) left stale, e.g. a node dragged and dropped
    back outside any dropzone settling one row too low, or a connector line
    rendering stale geometry:

    - Keyed by selector _object_, it skipped a scope's copy of a selector that
      was also live in the root (the same object has a different value per
      store).
    - It locked in a value an early pass computed from an intermediate
      _selector_ that a later pass corrected (e.g. a scope selector reached via
      a root atom before its sibling scope selector settled).

    The dedup guard is **removed**. Multi-pass commits now (1) write every value
    across every store first, (2) let each store re-derive its own selectors
    against that final state — a selector reachable by two passes is simply
    recomputed in each, and the equality check prunes the redundant result — and
    (3) **defer subscriber notification to the end of the commit**, partitioned
    **per store**, firing each store's subscribers once against the members that
    changed in that store. This makes a transaction _serializable to observe_:
    no subscriber, and nothing a **synchronous** selector a subscriber reads,
    ever sees a half-applied intermediate. (An async/Promise selector still
    notifies again when its promise resolves — a separate, later microtask — so
    the "exactly once with the final value" guarantee is for synchronous
    selectors.) Per-store partitioning also keeps an atomFamily subscriber in
    one store from firing for members that only changed in another store. A
    selector reachable by multiple passes now has its body run once per reaching
    pass (the dropped optimization); the single-store / non-scoped hot path is
    untouched.

    **`index()` crash / desync across stores.** `index()` kept a mutable Set +
    Map of current members in closure scope and mutated them from inside a
    selector evaluation. Because selectors evaluate independently per store,
    reading the same index in both a root and a scope with divergent family
    membership (e.g. publish moving members between a scope and the root)
    clobbered the shared state, and the filtered selector could iterate a member
    whose predicate-selector entry had been deleted by the other store's
    evaluation — throwing `Cannot convert undefined or null to object`.
    `index()` now derives membership from `get(family)` on every evaluation
    (correct per store) and caches per-atom predicate selectors in a
    store-agnostic `WeakMap` keyed by the family-atom (a lookup is never
    undefined for a live member, and a deleted member's entry becomes
    GC-eligible rather than leaking on create/delete/recreate churn).

    `isAtom` and `isGlobalAtom` also gained the `state && …` null-guard the
    other `is*` helpers already have, so a stale read degrades gracefully
    instead of crashing in `Object.hasOwn(undefined, …)`.

- [#171](https://github.com/eigilsagafos/valdres/pull/171)
  [`9913633`](https://github.com/eigilsagafos/valdres/commit/991363340a9b626c818f58e1945727f850fa48f6)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix: setting a
  no-default ("suspense") atom inside a transaction now resolves the
  pending-default placeholder promise, matching plain `store.set`. Previously
  the transaction write path (`writeAtoms`) wrote the value but never called
  `resolvePendingDefault`, so a reader suspended on the placeholder hung forever
  even though the value was set — same intent as `set`, silently different
  result.

    `resolvePendingDefault` is extracted from `setAtom` into `lib/` so every
    write path can share it. The new call in `writeAtoms` is gated on the prior
    value being a promise (a placeholder is always stored as one), so the common
    non-promise transaction write skips the scope-chain walk and the
    benchmark-gated txn hot path is unaffected.

## 1.0.0-beta.5

### Minor Changes

- [#165](https://github.com/eigilsagafos/valdres/pull/165)
  [`6fef9c9`](https://github.com/eigilsagafos/valdres/commit/6fef9c9fc8a8a481dbacce2768bc09e413f80bdf)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - **Atom values are
  now deep-frozen in development/test only, not in production.**

    Valdres deep-freezes every object atom value on write so accidental in-place
    mutation (`state.foo = x`, `arr.push(...)`) throws a `TypeError` instead of
    silently corrupting state. Until now this ran in _every_ build because
    `isProd()` was hardcoded to `false`. It now honors `process.env.NODE_ENV`,
    so production builds skip the freeze entirely — worth up to ~15–20% on
    write-heavy workloads (e.g. bulk inserts of object values); a single small
    write saves less. This matches how Recoil (`__DEV__`-gated freeze) and Redux
    Toolkit (dev-only immutability checks) treat the same safety net: a dev-time
    aid, not a prod cost.

    **⚠️ Migration — read before upgrading.** If your app mutates atom values in
    place, that bug was previously caught by a thrown `TypeError` in both dev
    and prod. After this change it is still caught in dev/test, but in
    **production it will silently corrupt state** (symptoms look like flaky
    reactivity, not a clear error). Before shipping:

    - Audit for in-place mutation of values read from `store.get(...)` — e.g.
      `value.push(...)`, `value.x = ...`, `Object.assign(value, ...)`,
      `value.sort()`/`splice()`.
    - Replace them with immutable updates (return a new object/array), or mark
      the atom `{ mutable: true }` if mutation is intentional.
    - Run your test suite under `NODE_ENV !== "production"`, where the freeze
      still throws and surfaces these bugs for you.

    Also: `deepFreeze` now allocates its cycle-guard `WeakSet` lazily — flat
    values (the common case, e.g. `{ title, body }`) no longer allocate one at
    all, making the dev/test freeze itself ~20% cheaper. Cycle and nested-graph
    behavior is unchanged.

### Patch Changes

- [#168](https://github.com/eigilsagafos/valdres/pull/168)
  [`fde2ec1`](https://github.com/eigilsagafos/valdres/commit/fde2ec1aa4da44a9f3fddddd5b7c7c03eeaba796)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Make `store.txn()`
  atomically observable across scopes. A single transaction that writes to the
  root and to one or more scopes (via `t.scope(...)` / `t.parentScope(...)`) is
  now committed as write-everything-then-notify-everything: all values across
  the whole store tree are applied first, then a single notification pass runs.
  Previously each store committed and propagated in sequence, so a root
  subscriber, `onSet` hook, or a selector spanning root + scope could observe a
  half-applied transaction (root = new while a scope was still old, or scope A
  applied before scope B's writes landed). The final committed state was always
  consistent — only the observation was non-atomic.

    `atom.onSet` now fires in the notify phase (after all writes) for the
    cross-scope path, so a hook reading any atom sees the fully-applied
    transaction; it still fires before subscribers, preserving the prior
    relative ordering. The single-store / non-scoped-txn fast path is unchanged
    in both behavior (onSet fires inline during the write loop) and performance.

    Two related fixes fall out of the coordinated commit:

    - A direct subscription created in a scope before the scope shadows an atom
      is now correctly re-rooted when one transaction both writes that atom at
      the root and shadows it in the scope — the subscriber fires once (it
      previously fired twice), matching the non-transaction `set()` path.
    - A selector reachable by more than one store's propagation pass in a single
      cross-scope commit (one spanning an ancestor atom and a scope atom, or an
      updated atom and a deleted family) is now evaluated exactly once per
      commit instead of once per reaching pass.
    - Adding or deleting a family member at the root inside a transaction now
      cascades into scopes that already shadow that family (their dependent
      selectors and subscribers see the change). Previously the transaction
      cloned a new root family index and the shadowing scope kept pointing at
      the old one, so it never observed the add/delete — the non-transaction
      `del`/`set` path was already correct.

- [#169](https://github.com/eigilsagafos/valdres/pull/169)
  [`f32eb3e`](https://github.com/eigilsagafos/valdres/commit/f32eb3ef0092e7756e89eb5b3944f091726401e4)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix stale selectors
  after dynamic-dependency changes (regression in 1.0.0-beta.4).

    The topological selector-update propagation introduced in beta.4 builds a
    static closure and per-node `pending` counts before the walk, assuming the
    dependency graph is fixed for its duration. A selector re-evaluated
    out-of-band during the walk — most commonly lazily re-initialized via `get`
    when another selector reads it after its value was dropped by
    orphan-invalidation/unsubscribe — mutates the graph mid-walk. That left two
    classes of node permanently stale: nodes materialized after the closure was
    built ("escaped"), and nodes that dropped a snapshotted dependency so their
    `pending` never drained ("stranded").

    This surfaced in apps with conditional ("dragging" vs "settled") selector
    branches that swap dependencies on interaction: after toggling a branch and
    back, derived selectors could return values computed from inputs that no
    longer applied. `advance()` now pulls escaped dependents into the closure,
    and a fixpoint settle pass re-evaluates stranded nodes (and their
    dependents). The steady-state fast path is unaffected — the settle only runs
    when a stall is actually detected.

## 1.0.0-beta.4

### Minor Changes

- [#134](https://github.com/eigilsagafos/valdres/pull/134)
  [`73c2c8f`](https://github.com/eigilsagafos/valdres/commit/73c2c8f4528f1e8ddad331dd0017eeb7ca01c5ec)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Replace the
  per-call upward walk in `isTransitivelySubscribed` with a cached liveness flag
  (`liveDependentCount`) maintained incrementally on sub/unsub and on dependency
  add/remove events. Selector evaluation paths that previously walked the
  dependents graph upward on every dep change now do an O(1) check, with
  propagation amortized across topology changes instead of repeated on every
  re-evaluation.

- [#144](https://github.com/eigilsagafos/valdres/pull/144)
  [`8393f22`](https://github.com/eigilsagafos/valdres/commit/8393f22a408b886a6ff83179eba65cd3a6da1513)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Allow user-provided
  `onSet` on global atoms. Previously, passing `onSet` to
  `atom(value, { global: true, onSet })` threw at construction because the field
  was reserved for the internal cross-store sync mechanism. The factory now
  composes both: cross-store sync runs first (peers receive the update with
  `skipOnSet=true`, so the user hook does not double-fire), then the user hook
  is invoked once, in the originating store.

- [#137](https://github.com/eigilsagafos/valdres/pull/137)
  [`f8a555a`](https://github.com/eigilsagafos/valdres/commit/f8a555a1b99139f63b16c737f9b49e6aee60fc2f)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Remove the
  iterative selector-init trampoline. Selector evaluation now uses plain
  recursion all the way down, matching jotai's strategy. This eliminates the
  ~26x perf cliff at chain depths >100 (caused by `NeedsInitError`
  exception-as-control-flow), and brings N=500 sub+unsub within parity of jotai.

    **Behavior change:** selector chains beyond the JavaScript engine's call
    stack capacity (~thousands of levels in practice) will now throw a
    `RangeError` (possibly wrapped in `SelectorEvaluationError`) instead of
    falling back to iterative evaluation. This matches jotai's failure mode and
    applies only to chains far deeper than realistic application code. The
    `processes deep atom a graph beyond maxDepth` jotai-compat test is now
    skipped since valdres no longer exceeds jotai's guarantees there.

### Patch Changes

- [#163](https://github.com/eigilsagafos/valdres/pull/163)
  [`f1afcc6`](https://github.com/eigilsagafos/valdres/commit/f1afcc6593854b86f9ae7387a8c00493f68a8ff7)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Speed up the
  `atomFamily(id)` cache-hit hot path — the only benchmark where valdres trailed
  Jotai on Bun/JSC (~15ns vs 6ns). The hot path used a rest parameter
  (`(...args)`), which forces a fresh array allocation on every call, plus a
  cross-module `familyKey()` call that acts as an inlining barrier. Ablation
  showed the rest-array allocation was the dominant cost (~7ns) and the call a
  minor one (~2ns).

    The cache-hit path now declares a single positional parameter and reads only
    `arguments.length` (never indexing `arguments`), so the engine can skip both
    the rest-array allocation and materializing the arguments object; a single
    primitive arg is its own cache key, so it looks up the map directly with no
    `familyKey()` call. Object / multi-arg / non-primitive calls fall through to
    the original variadic logic unchanged. Construction moves to a cold
    `build()` helper that only runs on a cache miss.

    Result: cache hit drops to ~6ns on Bun (Jotai parity) and ~2ns on Node/V8
    (from ~12ns), a strict win on both engines with identical behavior. The
    create/miss path also benefits, since single-primitive args now skip
    `familyKey()` entirely.

- [#153](https://github.com/eigilsagafos/valdres/pull/153)
  [`396a061`](https://github.com/eigilsagafos/valdres/commit/396a06183089ef4377a69f9580e30e025a1b7218)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Topologically
  schedule downstream selector re-evaluation during propagation so each
  transitive (non-initial) selector runs its `get` at most once per transaction
  commit. The previous BFS-by-depth pass recomputed any selector reachable
  through paths of differing lengths once per depth — a sink reading both an
  atom directly and a chain of intermediate selectors derived from that atom
  previously evaluated `chainLen + 1` times.

    The initial dirty sweep keeps the legacy linear pass so flat-fan-out and
    init-only chain initialization (where re-evaluations almost always produce
    unchanged values) pay zero topo overhead. The topo pass only runs when at
    least one initial selector's value actually shifted, so workloads that don't
    benefit from dedup don't pay for it.

- [#129](https://github.com/eigilsagafos/valdres/pull/129)
  [`89838ee`](https://github.com/eigilsagafos/valdres/commit/89838eea5a65c161fb8d294d48257f3ba7602122)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Skip the transitive
  mount/unmount walk when the start state is a leaf with no `onMount`. The walk
  allocates a `Set` and `Array` and was firing on every selector dep change
  during propagation, even when the dep was a plain atom with no mountable
  subtree — which is the common case. The cached liveness flag
  ([#134](https://github.com/eigilsagafos/valdres/issues/134)) already makes the
  upstream check O(1), but the downstream `mountTransitiveDeps(dep)` /
  `unmountOrphanedDeps(dep)` calls still walked the subtree from each
  added/removed dep. On the new propagation bench (median of 5 runs) this trims
  ~6% off the load-entity integration shape (200 subscribed selectors, churning
  deps) and ~7-8% off the dep-churn microbench.

    Also adds `packages/valdres/test/performance/propagation.bench.ts` covering
    plain fan-out, dep churn, structured family args, and a load-entity
    integration shape, so future regressions in propagation are caught
    automatically.

- [#162](https://github.com/eigilsagafos/valdres/pull/162)
  [`979fa2c`](https://github.com/eigilsagafos/valdres/commit/979fa2c8e6038f25eb820e15f2d12730e153f39b)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Speed up selector
  initialization on V8 (Node). `evaluateSelector` no longer builds a
  per-evaluation options object with an accessor `signal` getter for selectors
  that don't declare the options parameter (`get.length < 2`) — they reuse the
  shared per-store sync options (real `storeId`, non-abortable `signal`) and
  skip the `abortControllers` WeakMap traffic. Cuts ~15–20% off the Node
  `sub+unsub` chain-init latency (now matching or beating Jotai on small/medium
  chains) with no measurable change on Bun/JSC and no behavior change for
  selectors that declare `options` positionally or via destructuring
  (`(get, opts)`, `(get, { signal })`).

- [#133](https://github.com/eigilsagafos/valdres/pull/133)
  [`ab18cae`](https://github.com/eigilsagafos/valdres/commit/ab18cae6b96885c9afd2cfd81fc6336f7a7788d6)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Internal cleanup:
  reduce allocations during selector propagation. Re-evaluating a dirty selector
  previously allocated two empty tracking Sets (for added/removed dependencies)
  on every pass, even though both stay empty in the common case where a
  selector's dependencies don't change. Those Sets are now allocated lazily —
  only when a dependency is actually added or removed — and the tracking state
  is reused across each propagation pass. Measures ~2–5% faster on
  allocation-heavy propagation microbenchmarks (within noise on the largest
  fan-outs); no behavior change.

- [#142](https://github.com/eigilsagafos/valdres/pull/142)
  [`69b0e6d`](https://github.com/eigilsagafos/valdres/commit/69b0e6da6c1c6a62e900d9e48d13d75340764982)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Move the
  pending-default suspense placeholder for atoms declared with no `defaultValue`
  from monkey-patched `__isEmptyAtomPromise__` / `__resolveEmptyAtomPromise__` /
  `__emptyAtomPromiseOrigin__` properties on Promise instances to a `WeakMap` on
  the store data. The Promise returned by `get()` is now a plain Promise with no
  internal markers leaked to user code.

    Fixes two latent bugs along the way: a sync `set()` after an in-flight async
    `set()` on an empty atom now resolves the suspense placeholder (previously
    it hung); and `set()` from a scoped store on an empty atom inited in a
    parent now resolves the placeholder via the scope chain (previously hung).

- [#141](https://github.com/eigilsagafos/valdres/pull/141)
  [`fa8db1b`](https://github.com/eigilsagafos/valdres/commit/fa8db1b83675544d68cba2000df708b606f54511)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Move selector
  evaluation state (`circularDepSet`, `latestEvalContext`) from module-level to
  `StoreData`. Two fixes:

    - The same selector evaluated across two stores no longer triggers a
      spurious `SelectorCircularDependencyError` when one store's evaluation
      synchronously asks another store for the same selector.
    - Async selectors with deferred (post-await) `get` calls now correctly
      register dependencies even when the same selector is evaluated
      concurrently in another store. Previously the second store's eval would
      mark the first store's eval context `revoked`, causing the deferred `get`
      to fall into the read-only "stale closure" branch and silently drop dep
      registration.

    Both sets allocate lazily on first access (same pattern as the other
    per-store maps), so store creation overhead is unchanged.

- [#146](https://github.com/eigilsagafos/valdres/pull/146)
  [`9f011c9`](https://github.com/eigilsagafos/valdres/commit/9f011c915d4c8a1fbb2b3e886014890444e93afc)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Unify
  `RootStoreData` and `ScopedStoreData` into a single `StoreData` shape with an
  optional `parent`. Structural `"parent" in data` branches collapse to
  `data.parent` checks, dropping three `@ts-ignore @ts-todo` markers from
  `getState.ts` and `transaction.ts`.

    Fix two surprises around `maxAge` × scope shadows:

    - `scope.set(maxAgeAtom, value)` is now a deliberate pin. The lazy
      revalidation guard in `isCachedValueStale` no longer evicts scope-local
      values past their TTL, so the shadow survives an unsubscribed read instead
      of silently falling back to the parent.
    - Subscribing to a scope-shadowed `maxAge` atom no longer installs a second,
      scope-local revalidation timer that would overwrite the shadow and
      double-invoke `defaultValue()`. Non-shadowed scope subscriptions continue
      to delegate up to the parent's timer as before.

- [#151](https://github.com/eigilsagafos/valdres/pull/151)
  [`37c9afa`](https://github.com/eigilsagafos/valdres/commit/37c9afae8c6aae6b0f4e9a2b8b38b32d3c3ca7bd)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - `selectorFamily` no
  longer wraps the user's factory in a per-cache-miss closure that re-invoked
  `callback(...args)` on every selector evaluation. The inner getter is now
  stored on the selector object directly at cache-miss time, so each evaluation
  skips one closure call and one closure allocation. `sel.get` is also
  identity-stable across reads, which keeps downstream identity-based caches
  honest.

- [#135](https://github.com/eigilsagafos/valdres/pull/135)
  [`0f3ce03`](https://github.com/eigilsagafos/valdres/commit/0f3ce03669b3ac92b26d1d047e850b6005a924fe)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Refactor
  `propagateUpdatedAtoms` into two purpose-built functions:
  `propagateAtomUpdate` for top-level updates (collect direct subscribers, walk
  dependent selectors, cross into scopes) and `propagateInScope` for scope-level
  recursion (selector walk + scope recursion only, since the parent scope
  already notified atom subscribers and family-index updates have already
  cascaded). Drops three dead parameters (`isRecursive`, externally-passed
  `subscriptions` and `families`) and the `selectorsOnly` boolean — these are
  now encoded by which function the caller chooses. Pure refactor: no behavior
  change, full test suite green, benchmarks unchanged.

## 1.0.0-beta.3

### Patch Changes

- [#131](https://github.com/eigilsagafos/valdres/pull/131)
  [`36f7524`](https://github.com/eigilsagafos/valdres/commit/36f75240f8fed2d0441fd30f360ed2dec24fafe1)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Defer
  `AbortController` allocation on the first evaluation of a selector until the
  selector body actually reads `options.signal`. `options.signal` is now a lazy
  getter, so selectors that don't use the signal (the common case) pay no
  allocation cost on their first eval. The known-sync cache still short-circuits
  subsequent evaluations to a shared options object. Aborting a previous
  controller on re-eval and storing the new controller for async re-eval
  cancellation are preserved.

## 1.0.0-beta.2

### Patch Changes

- [#128](https://github.com/eigilsagafos/valdres/pull/128)
  [`6c3a33b`](https://github.com/eigilsagafos/valdres/commit/6c3a33be48a8024907bd995ff6162fd4c00f1f28)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix spurious
  `SelectorCircularDependencyError` for selectors with no real cycle.
  `evaluateSelector` now runs its cleanup in a `finally` so the module-level
  `sharedCircularDepSet` is always cleared on exit — including when an inner
  selector throws a non-cycle error and the outer's `catch` re-raises a
  `SelectorEvaluationError`. Previously the entry leaked, and the next read of
  the outer selector tripped the cycle check on a stale entry.

## 1.0.0-beta.1

### Patch Changes

- [#123](https://github.com/eigilsagafos/valdres/pull/123)
  [`ca1f266`](https://github.com/eigilsagafos/valdres/commit/ca1f266b1af0970161584da3cc0c1271a2c97ba2)
  Thanks [@eigilsagafos](https://github.com/eigilsagafos)! - Fix `workspace:^`
  leaking into published manifests. The previous beta releases shipped with
  literal `"valdres": "workspace:^"` in their `dependencies`, which npm cannot
  resolve. Changesets only rewrites pinned workspace specs (e.g.
  `workspace:^1.2.3`), and `changeset publish` shells out to `npm publish` —
  which doesn't understand the workspace protocol — so the bare shortcut got
  published verbatim. Publishable packages now use plain semver ranges for
  inter-package deps; changesets keeps them in lockstep on every bump, and
  `verify-publish` fails CI if any `workspace:` reference sneaks back in.

    The six Lerna-era packages still on the `pre` dist-tag
    (`@valdres/color-mode`, `@valdres/hotkeys`, `@valdres-react/color-mode`,
    `@valdres-react/draggable`, `@valdres-react/hotkeys`,
    `@valdres-react/panable`) get a `minor` bump so they land on `0.3.0-beta.0`
    — a clean transition from the old `0.2.0-pre.28` line to the unified `beta`
    dist-tag.
