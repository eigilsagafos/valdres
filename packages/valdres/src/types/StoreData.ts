import type { Selector } from "./Selector"
import type { Store } from "./Store"
import type { Subscription } from "./Subscription"

export type RootStoreData = {
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
    storeRef?: Store
    scopes: Map<string, ScopedStoreData>
    batchUpdates?: boolean
    scopeValueIndex: WeakMap<WeakKey, Set<ScopedStoreData>>
}

export type ScopedStoreData = RootStoreData & {
    parent: StoreData
    scopeConsumers: Set<() => void>
    scopeIndexKeys: Set<WeakKey>
}

export type StoreData = RootStoreData | ScopedStoreData
