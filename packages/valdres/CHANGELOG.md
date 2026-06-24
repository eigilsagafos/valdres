# valdres

## 1.0.0-beta.15

### Patch Changes

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
