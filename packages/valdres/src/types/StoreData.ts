import type { Subscription } from "./Subscription"

export type RootStoreData = {
    id: string
    values: WeakMap<WeakKey, any>
    expiredValues: WeakMap<WeakKey, any>
    subscriptions: WeakMap<WeakKey, Set<Subscription>>
    subscriptionsRequireEqualCheck: WeakMap<WeakKey, boolean>
    stateDependents: WeakMap<WeakKey, any>
    stateDependencies: WeakMap<WeakKey, any>
    scopes: { [scopeId: string]: ScopedStoreData }
}

export type ScopedStoreData = RootStoreData & {
    parent: StoreData
    scopeConsumers: Set<() => void>
}

export type StoreData = RootStoreData | ScopedStoreData
