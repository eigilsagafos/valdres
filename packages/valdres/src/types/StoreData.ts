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
