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
    abortControllers: WeakMap<WeakKey, AbortController | false>
    /** Per-atom timestamp of the last value write, used for lazy
     *  maxAge revalidation when the atom is unmounted (no active timer
     *  to keep the cache fresh). Only populated for atoms with `maxAge`. */
    lastValueWriteAt: WeakMap<WeakKey, number>
    storeRef?: Store
    scopes: Map<string, ScopedStoreData>
    batchUpdates?: boolean
    schemaValidation?: boolean
    scopeValueIndex: WeakMap<WeakKey, Set<ScopedStoreData>>
}

export type ScopedStoreData = RootStoreData & {
    parent: StoreData
    scopeConsumers: Set<() => void>
    scopeIndexKeys: Set<WeakKey>
}

export type StoreData = RootStoreData | ScopedStoreData
