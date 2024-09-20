export type StoreData = {
    id: string
    values: WeakMap<WeakKey, any>
    expiredValues: WeakMap<WeakKey, any>
    subscriptions: WeakMap<WeakKey, Set<any>>
    subscriptionsRequireEqualCheck: WeakMap<WeakKey, boolean>
    stateConsumers: WeakMap<WeakKey, any>
    stateDependencies: WeakMap<WeakKey, any>
}
