import type { ScopedStoreData, StoreData } from "../types/StoreData"

const generateId = () => (Math.random() + 1).toString(36).substring(7)
const generateStoreData = (id: string = generateId()) => {
    return {
        id,
        values: new WeakMap(),
        expiredValues: new WeakMap(),
        subscriptions: new WeakMap(),
        subscriptionsRequireEqualCheck: new WeakMap(),
        stateConsumers: new WeakMap(),
        stateDependencies: new WeakMap(),
        scopes: {},
    }
}

export function createStoreData(id?: string, parent?: undefined): StoreData
export function createStoreData(id: string, parent: StoreData): ScopedStoreData
export function createStoreData(id?: string, parent?: StoreData) {
    if (parent) {
        return {
            ...generateStoreData(id),
            parent,
            scopeConsumers: parent ? new Set() : undefined,
        }
    } else {
        return generateStoreData(id)
    }
}
