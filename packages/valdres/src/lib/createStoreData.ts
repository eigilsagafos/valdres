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
    /** Retain values enumerably (a `Map`, not a `WeakMap`) so `store.snapshot()`
     *  can list the store's current state. Off by default; see `Store.snapshot`.
     *  Scopes inherit it from their parent. */
    enumerable?: boolean
    /** Validate atom/selector values against their `schema` (if any) on init,
     *  set, and selector evaluation. Off by default — opt in per store for
     *  development-time safety. Scopes inherit it from their parent. */
    schemaValidation?: boolean
}

export function createStoreData(
    id?: string,
    parent?: StoreData,
    options?: CreateStoreDataOptions,
): StoreData {
    const data: any = Object.create(lazyProto)
    data.id = id ?? generateId()
    // Chosen once, here — never re-checked on get/set. A scope inherits its
    // parent's mode so an enumerable store is enumerable all the way down.
    const enumerable = options?.enumerable ?? parent?.enumerable ?? false
    if (enumerable) data.enumerable = true
    data.values = enumerable ? new Map() : new WeakMap()
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
    // Opt-in, inherited down the scope chain like `enumerable` — chosen once
    // here, never re-checked on get/set.
    const schemaValidation =
        options?.schemaValidation ?? parent?.schemaValidation ?? false
    if (schemaValidation) data.schemaValidation = true
    if (parent) {
        data.parent = parent
        data.scopeConsumers = new Set()
        data.scopeIndexKeys = new Set()
    }
    return data
}
