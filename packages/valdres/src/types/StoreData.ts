import type { Selector } from "./Selector"
import type { Store } from "./Store"
import type { StoreChangeCallback } from "./StoreChangeCallback"
import type { Subscription } from "./Subscription"

export type StoreData = {
    id: string
    /** The store's materialized values, keyed by state identity. A `WeakMap` by
     *  default so unreferenced atoms/selectors are collected (guarded by
     *  test/memoryleaks.test.ts); a `Map` when the store was created with
     *  `{ enumerable: true }`, which retains entries for the store's lifetime so
     *  `store.snapshot()` can enumerate them. The two share the get/set/has/delete
     *  surface every call site uses, so the mode is a drop-in chosen once at
     *  creation — no per-call branch on the hot path. */
    values: WeakMap<WeakKey, any> | Map<WeakKey, any>
    subscriptions: WeakMap<WeakKey, Set<Subscription>>
    subscriptionsRequireEqualCheck: WeakMap<WeakKey, boolean>
    stateDependents: WeakMap<WeakKey, any>
    stateDependencies: WeakMap<WeakKey, any>
    mounts: WeakMap<WeakKey, { cleanup?: () => void }>
    /** Count of dependents (selectors that read this state) that are
     *  currently "live" (transitively subscribed). A state is live iff it
     *  has direct subscribers OR this count is > 0. Maintained incrementally
     *  on sub/unsub and on dep add/remove instead of walking the graph. */
    liveDependentCount: WeakMap<WeakKey, number>
    /** True while a selector-update / cold-read pass owns the liveness collector.
     *  This (not `livenessSeeds`) is the ownership token, so the Set can be
     *  allocated LAZILY on the first actual seed: a no-churn pass (or a first-init
     *  read, which seeds nothing) never allocates one. Critical on fan-out-to-
     *  many-stores paths (e.g. set-atom-across-1000-scopes runs 1000 no-churn
     *  passes per write — eager allocation was 1000 wasted Sets). */
    livenessPassActive?: boolean
    /** Transient, set only while a pass is in flight: every selector whose
     *  dependency SET changed during the pass (added or removed, via the
     *  propagation loop OR a lazy re-init through `get`), plus the removed deps.
     *  Drives the region the end-of-pass liveness reconcile recomputes from
     *  reachability. Allocated lazily on first seed (see `livenessPassActive`) and
     *  reset to undefined when the owning pass ends — the no-churn / first-init
     *  fast path never allocates it. */
    livenessSeeds?: Set<WeakKey>
    /** Transient, set only while a pass is in flight: true once a dependency was
     *  REMOVED. A removal is the only loop-driven event the incremental refcount
     *  can't always settle — but ONLY when the affected region contains a cycle
     *  (`propagateNotLive` can't collect a cyclic group → leak; a transient
     *  drop-then-readd can strand a still-read selector → freeze, and that
     *  stranding requires the selector to sit on a cycle through the removed
     *  dep). On an acyclic region the refcount is exact, so the end-of-pass
     *  reconcile is armed by this flag but still gated on `regionHasCycle`. */
    livenessRemovalArmed?: boolean
    /** Transient, set only while a pass is in flight: true once a dep-set changed
     *  via a LAZY re-init through `get` (no `depsChangeOut`), which commits edges
     *  without going through the propagation loop's onLiveDependency* calls at
     *  all. This arms the reconcile UNCONDITIONALLY (no cycle gate) — a lazy
     *  re-init can mis-count even an acyclic graph because the incremental path
     *  never ran for it. Lazy re-inits are off the hot path, so this is cheap. */
    livenessLazyArmed?: boolean
    abortControllers: WeakMap<WeakKey, AbortController | false>
    /** Selectors currently mid-evaluation in this store. Used for cycle
     *  detection. Per-store so that the same selector evaluated in two
     *  stores doesn't trigger a spurious cycle. Add at evaluateSelector
     *  entry, delete in `finally` — balanced over synchronous eval. */
    circularDepSet: WeakSet<Selector>
    /** Latest evaluation context per selector for revoking deferred (post-
     *  await) `get` calls from superseded evaluations. Per-store so that
     *  store2 evaluating a shared selector doesn't silently strip dep
     *  registration from store1's in-flight async eval. */
    latestEvalContext: WeakMap<Selector, { revoked: boolean }>
    /** Per-atom timestamp of the last value write, used for lazy
     *  maxAge revalidation when the atom is unmounted (no active timer
     *  to keep the cache fresh). Only populated for atoms with `maxAge`. */
    lastValueWriteAt: WeakMap<WeakKey, number>
    /** Per-atom suspense placeholder for atoms declared with no
     *  `defaultValue`. The first read creates an unresolved promise that
     *  external readers (Suspense, `await store.get(atom)`) hold; the
     *  next `setAtom` resolves it with the eventual value. Keyed by atom
     *  identity so the lifecycle is independent of the promise stored in
     *  `values` (which may be replaced by user-supplied async sets). */
    pendingDefaults: WeakMap<WeakKey, { promise: Promise<any>; resolve: (value: any) => void }>
    storeRef?: Store
    /** True when this store was created with `{ enumerable: true }`: `values` is
     *  a `Map` (not a `WeakMap`) so `store.snapshot()` can list current state.
     *  Set once at creation and inherited by every (nested) scope. */
    enumerable?: boolean
    scopes: Map<string, StoreData>
    batchUpdates?: boolean
    schemaValidation?: boolean
    scopeValueIndex: WeakMap<WeakKey, Set<StoreData>>
    /** Present iff this is a scoped store. Root stores have `parent: undefined`. */
    parent?: StoreData
    /** Present iff this is a scoped store. Tracks active scope consumers
     *  so the scope can be detached when the last consumer leaves. */
    scopeConsumers?: Set<(expectedToDestroy?: boolean) => boolean>
    /** Present iff this is a scoped store. Records keys this scope registered
     *  in its parent's `scopeValueIndex`, used for cleanup on detach. */
    scopeIndexKeys?: Set<WeakKey>
    /** Store-wide change listeners registered via `store.onChange`, each mapped
     *  to the kinds of change it opted into: `atoms` (default true) and
     *  `selectors` (default false). Absent (undefined) until the first listener
     *  is added and reset to undefined when the last one leaves, so the write hot
     *  path stays allocation-free when nobody is watching. */
    changeListeners?: Map<
        StoreChangeCallback,
        { atoms: boolean; selectors: boolean }
    >
    /** Commit-end listeners registered via `store.onCommitEnd`. Root stores
     *  only — a listener registered through a scoped store is attached to the
     *  tree's root, and a commit anywhere in the tree fires the root's set.
     *  Absent until the first listener is added and reset to undefined when the
     *  last one leaves (see lib/onCommitEnd.ts). */
    commitEndListeners?: Set<() => void>
    /** Re-entrancy depth of in-flight commit boundaries for this store TREE
     *  (root stores only). Tracked only while `onCommitEnd` listeners exist
     *  anywhere; listeners fire when the OUTERMOST boundary closes, so writes a
     *  subscriber performs during a commit coalesce into one notification. */
    commitDepth?: number
}
