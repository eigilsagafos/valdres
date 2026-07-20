import type { Selector } from "./Selector"
import type { State } from "./State"
import type { StoreChangeCallback } from "./StoreChangeCallback"
import type { Subscription } from "./Subscription"
import type { ArchitectureInstrumentation } from "../lib/architectureInstrumentation"

export type SelectorEvaluationContext = {
    readonly revoked: boolean
    /** Revoke deferred reads and abort work owned by this evaluation unless
     * its signal was explicitly preserved for suspension/unmount cleanup. */
    revoke(): void
    /** Detach this evaluation's signal from cancellation without aborting it. */
    preserveSignal(): void
    /** All dependencies read by this async evaluation. Kept on the evaluation
     *  identity so two stores/selectors may safely return the same Promise. */
    asyncDeps?: Set<State>
    /** Revision observed by each deferred async dependency read. This keeps a
     *  cold async result from claiming freshness if a dependency changed while
     *  its Promise was in flight. */
    asyncDependencyRevisions?: Map<State, number>
}

export type ColdSelectorCache = {
    /** Weak-key-owned forward references aligned with `dependencyRevisions`.
     * The array is reused across evaluations and disappears with the selector;
     * unlike a reverse edge, no long-lived dependency points back to it. */
    dependencies: State[]
    dependencyRevisions: number[]
    validatedAt: number
    /** Atom/family-only dependency sets cannot contain a selector cycle, so
     * their validation skips the recursive cycle guard entirely. */
    hasSelectorDependencies: boolean
}

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
    /** Active subscribed states, with `true` only when at least one callback
     *  requires structural equality. The iterable keys also let terminal
     *  disposal drain the otherwise-weak subscription table. Entries are
     *  deleted synchronously with the final subscriber. */
    subscriptionsRequireEqualCheck: Map<State, true | undefined>
    stateDependents: WeakMap<WeakKey, any>
    stateDependencies: WeakMap<WeakKey, any>
    /** Selectors whose forward dependency sets are currently mirrored into the
     *  iterable reverse graph. Cold selectors are deliberately absent. */
    selectorGraphActive: WeakSet<WeakKey>
    /** Dependency-revision snapshots for cached, non-live selectors. */
    coldSelectorCaches: WeakMap<WeakKey, ColdSelectorCache>
    /** Set on this store after its first cold selector cache. Kept as an eager
     *  scalar so atom-only cache hits can skip the lazy WeakMap without a state
     *  shape check or nested revision-clock lookup. */
    coldSelectorCachesEnabled: boolean
    /** Per-state value revision. Scoped reads fall through to an ancestor when
     *  the state has no local value/revision. */
    stateRevisions: WeakMap<WeakKey, number>
    /** Shared by a root store and every scope. It is enabled lazily by the first
     *  cold selector so atom-only stores don't maintain revision entries. */
    stateRevisionClock: {
        current: number
        enabled: boolean
        /** States directly referenced by at least one cold cache. Weak
         *  membership lets writes skip revision-map churn for unrelated states
         *  without retaining either side of the dependency. */
        tracked?: WeakSet<WeakKey>
    }
    /** Cycle guard for recursive validation of cached selector dependencies. */
    coldCacheValidationSet: WeakSet<WeakKey>
    /** Stable per-store order assigned when a selector first materializes its
     *  dependency set. An edge to an equal/newer selector violates this order,
     *  making a directed cycle possible in that closure. */
    dependencyOrder: WeakMap<WeakKey, number>
    nextDependencyOrder: number
    /** Monotonic, conservative marker: present when a state's downward closure
     *  may contain an edge that violates `dependencyOrder`. Every real cycle has
     *  at least one such edge, so absence proves the closure acyclic in O(1).
     *  Stale positives after edge removal only cost a fallback DFS. */
    cycleRiskInClosure: WeakMap<WeakKey, true>
    /** Monotonic generation for live dependency-graph materialization/churn.
     *  Active selector evaluation and cold-to-live promotion increment it.
     *  Cold forward caches do not. Orphan teardown only removes edges and
     *  deliberately leaves it unchanged: deletion cannot create a cycle, so a
     *  synchronous unsubscribe burst can reuse both negative cycle proofs and
     *  completed orphan-walk visits. */
    dependencyGraphVersion: number
    /** `state -> dependencyGraphVersion` for closures proven acyclic. A cached
     *  negative remains valid while teardown only deletes edges; any normal graph
     *  construction/churn bumps `dependencyGraphVersion` and invalidates it. */
    acyclicDependencyVersion: WeakMap<WeakKey, number>
    /** `state -> dependencyGraphVersion` for non-live states whose orphan graph
     *  work has completed. This is the shared visited set for a deletion-only
     *  unsubscribe burst, without retaining states strongly between calls. */
    orphanCleanupVersion: WeakMap<WeakKey, number>
    /** Strong only until the queued microtask drains it. Batches orphan graph
     *  cleanup roots across a synchronous unsubscribe burst. */
    pendingOrphanCleanup?: Set<WeakKey>
    orphanCleanupScheduled: boolean
    mounts: WeakMap<WeakKey, { cleanup?: () => void }>
    /** Count of dependents (selectors that read this state) that are
     *  currently "live" (transitively subscribed). A state is live iff it
     *  has direct subscribers OR this count is > 0. Maintained incrementally
     *  on sub/unsub and on dep add/remove instead of walking the graph. */
    liveDependentCount: WeakMap<WeakKey, number>
    /** Per-state cache for the mount/unmount graph-walk short-circuit. A key is
     *  present (value `true`) iff at least one state in this state's DOWNWARD
     *  dependency closure — its strict transitive dependencies, NOT the state
     *  itself — carries an `onMount`/`__valdresOnMount` hook, i.e. a walk DOWN
     *  from here could find something to mount. Absent means no mountable
     *  descendant, so `mountTransitiveDeps`/`unmountOrphanedDeps` can return
     *  without walking (the common case: layout/derived selectors whose whole
     *  subtree is mount-free).
     *
     *  INVARIANT (one-directional, the only property the skip relies on): NO
     *  FALSE NEGATIVES. If a mountable descendant exists the key is present.
     *  The key MAY be stale-`true` after an edge removal shrinks the closure —
     *  that only costs a redundant (and self-clearing) walk, never a missed
     *  mount. Set + propagated UP on every edge add via `noteDependencyAdded`;
     *  cleared opportunistically when a full walk finds the subtree mount-free.
     *
     *  The invariant holds because the marker is populated as dependency edges
     *  form and mount hooks must exist before a state is first used (the
     *  `AtomOnMount` contract). The only way to get a stale-ABSENT marker is to
     *  attach a hook AFTER edges into its closure already exist — no edge add
     *  fires to mark it — which is exactly the unsupported "assign onMount after
     *  first use" case the contract forbids. So the skip is trusted on every
     *  path; supporting late assignment would require invalidating this cache on
     *  hook assignment, and a `State` has no back-reference to its stores. */
    mountInClosure: WeakMap<WeakKey, true>
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
    abortControllers: WeakMap<WeakKey, AbortController>
    /** Selectors currently mid-evaluation in this store. Used for cycle
     *  detection. Per-store so that the same selector evaluated in two
     *  stores doesn't trigger a spurious cycle. Add at evaluateSelector
     *  entry, delete in `finally` — balanced over synchronous eval. */
    circularDepSet: WeakSet<Selector>
    /** Latest evaluation context per selector for owning async dependencies and
     *  revoking deferred (post-await) `get` calls from superseded evaluations.
     *  Per-store so one store evaluating a shared selector cannot interfere
     *  with another store's in-flight async evaluation. */
    latestEvalContext: WeakMap<Selector, SelectorEvaluationContext>
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
    pendingDefaults: WeakMap<
        WeakKey,
        { promise: Promise<any>; resolve: (value: any) => void }
    >
    /** True when this store was created with `{ enumerable: true }`: `values` is
     *  a `Map` (not a `WeakMap`) so `store.snapshot()` can list current state.
     *  Set once at creation and inherited by every (nested) scope. */
    enumerable?: boolean
    scopes: Map<string, StoreData>
    batchUpdates?: boolean
    schemaValidation?: boolean
    scopeValueIndex: WeakMap<WeakKey, Set<StoreData>>
    /** Per inherited atom/family, the immediate child branches that contain at
     *  least one active dependent before any intervening atom shadow. Parent
     *  propagation uses this to enter only affected scope subtrees. */
    inheritedDependencyBranches: WeakMap<WeakKey, Set<StoreData>>
    /** Present iff this is a scoped store. Root stores have `parent: undefined`. */
    parent?: StoreData
    /** Present iff this is a scoped store. Tracks active scope consumers
     *  so the scope can be detached when the last consumer leaves. */
    scopeConsumers?: Set<(expectedToDestroy?: boolean) => boolean>
    /** Present iff this is a scoped store. Records keys this scope registered
     *  in its parent's `scopeValueIndex`, used for cleanup on detach. */
    scopeIndexKeys?: Set<WeakKey>
    /** Present iff this is a scoped store. Records inherited dependency keys
     *  for which this scope is registered as a branch in its parent's index. */
    inheritedDependencyKeys?: Set<WeakKey>
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
    /** Opt-in structural counters used only by architecture tests/benchmarks.
     * Absent on normal stores and intentionally not part of the public API. */
    architectureInstrumentation?: ArchitectureInstrumentation
}
