import type { StoreData } from "../types/StoreData"

let nextId = 0
const generateId = () => "__valdres_store_" + nextId++

function makeLazyGetter(key: string, factory: () => any = () => new WeakMap()) {
    return {
        get(this: any) {
            const value = factory()
            Object.defineProperty(this, key, {
                value,
                writable: true,
                configurable: true,
            })
            return value
        },
        configurable: true,
    }
}

// Shared prototype with lazy WeakMap getters — defined once, reused by all stores
const lazyProto = Object.create(Object.prototype)
Object.defineProperties(lazyProto, {
    subscriptions: makeLazyGetter("subscriptions"),
    subscriptionsRequireEqualCheck: makeLazyGetter("subscriptionsRequireEqualCheck"),
    stateDependents: makeLazyGetter("stateDependents"),
    stateDependencies: makeLazyGetter("stateDependencies"),
    mounts: makeLazyGetter("mounts"),
    liveDependentCount: makeLazyGetter("liveDependentCount"),
    abortControllers: makeLazyGetter("abortControllers"),
    lastValueWriteAt: makeLazyGetter("lastValueWriteAt"),
    circularDepSet: makeLazyGetter("circularDepSet", () => new WeakSet()),
    latestEvalContext: makeLazyGetter("latestEvalContext"),
})

export type CreateStoreDataOptions = {
    batchUpdates?: boolean
}

export function createStoreData(
    id?: string,
    parent?: StoreData,
    options?: CreateStoreDataOptions,
): StoreData {
    const data: any = Object.create(lazyProto)
    data.id = id ?? generateId()
    data.values = new WeakMap()
    data.scopes = new Map()
    data.scopeValueIndex = new WeakMap()
    // Eager (not lazy) because resolvePendingDefault in setAtom walks every
    // store in the scope chain on every setAtom call. Lazy would still
    // allocate on first setAtom — eager just makes that explicit and avoids
    // touching the prototype getter on the hot path.
    data.pendingDefaults = new WeakMap()
    if (options?.batchUpdates) {
        data.batchUpdates = true
    }
    if (parent) {
        data.parent = parent
        data.scopeConsumers = new Set()
        data.scopeIndexKeys = new Set()
    }
    return data
}
