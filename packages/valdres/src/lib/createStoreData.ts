import type { ScopedStoreData, StoreData } from "../types/StoreData"

let nextId = 0
const generateId = () => "__valdres_store_" + nextId++

function makeLazyGetter(key: string) {
    return {
        get(this: any) {
            const map = new WeakMap()
            Object.defineProperty(this, key, {
                value: map,
                writable: true,
                configurable: true,
            })
            return map
        },
        configurable: true,
    }
}

// Shared prototype with lazy WeakMap getters — defined once, reused by all stores
const lazyProto = Object.create(Object.prototype)
Object.defineProperties(lazyProto, {
    expiredValues: makeLazyGetter("expiredValues"),
    subscriptions: makeLazyGetter("subscriptions"),
    subscriptionsRequireEqualCheck: makeLazyGetter("subscriptionsRequireEqualCheck"),
    stateDependents: makeLazyGetter("stateDependents"),
    stateDependencies: makeLazyGetter("stateDependencies"),
    mounts: makeLazyGetter("mounts"),
    abortControllers: makeLazyGetter("abortControllers"),
})

export function createStoreData(id?: string, parent?: undefined): StoreData
export function createStoreData(id: string, parent: StoreData): ScopedStoreData
export function createStoreData(id?: string, parent?: StoreData) {
    const data: any = Object.create(lazyProto)
    data.id = id ?? generateId()
    data.values = new WeakMap()
    data.scopes = new Map()
    if (parent) {
        data.parent = parent
        data.scopeConsumers = new Set()
    }
    return data
}
