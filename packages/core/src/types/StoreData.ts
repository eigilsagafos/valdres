export type StoreData = {
    id: string
    values: WeakMap<WeakKey, any>
    subscriptions: WeakMap<WeakKey, any>
    stateConsumers: WeakMap<WeakKey, any>
    stateDependencies: WeakMap<WeakKey, any>
}
