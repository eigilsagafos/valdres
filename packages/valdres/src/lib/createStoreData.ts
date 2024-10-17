import type { StoreData } from "../types/StoreData"

const generateId = () => (Math.random() + 1).toString(36).substring(7)

export const createStoreData = (id: string = generateId()): StoreData => ({
    id,
    values: new WeakMap(),
    expiredValues: new WeakMap(),
    subscriptions: new WeakMap(),
    subscriptionsRequireEqualCheck: new WeakMap(),
    stateConsumers: new WeakMap(),
    stateDependencies: new WeakMap(),
})
