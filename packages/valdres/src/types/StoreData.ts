import type { Selector } from "./Selector"
import type { Store } from "./Store"
import type { StoreChangeCallback } from "./StoreChangeCallback"
import type { Subscription } from "./Subscription"

export type StoreData = {
    id: string
    values: WeakMap<WeakKey, any>
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
    scopes: Map<string, StoreData>
    batchUpdates?: boolean
    scopeValueIndex: WeakMap<WeakKey, Set<StoreData>>
    /** Present iff this is a scoped store. Root stores have `parent: undefined`. */
    parent?: StoreData
    /** Present iff this is a scoped store. Tracks active scope consumers
     *  so the scope can be detached when the last consumer leaves. */
    scopeConsumers?: Set<(expectedToDestroy?: boolean) => boolean>
    /** Present iff this is a scoped store. Records keys this scope registered
     *  in its parent's `scopeValueIndex`, used for cleanup on detach. */
    scopeIndexKeys?: Set<WeakKey>
    /** Store-wide change listeners registered via `store.onChange`. Absent
     *  (undefined) until the first listener is added and reset to undefined
     *  when the last one leaves, so the write hot path stays allocation-free
     *  when nobody is watching. */
    changeListeners?: Set<StoreChangeCallback>
}
