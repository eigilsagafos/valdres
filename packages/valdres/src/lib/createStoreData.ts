import type { StoreData } from "../types/StoreData"
import { STORE_RUNTIME } from "./storeRuntimeKey"
import { createStoreTreeRuntime } from "./storeTreeRuntime"

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
    subscriptionsRequireEqualCheck: makeLazyGetter(
        "subscriptionsRequireEqualCheck",
        () => new Map(),
    ),
    stateDependents: makeLazyGetter("stateDependents"),
    stateDependencies: makeLazyGetter("stateDependencies"),
    inheritedDependencyBranches: makeLazyGetter("inheritedDependencyBranches"),
    selectorGraphActive: makeLazyGetter(
        "selectorGraphActive",
        () => new WeakSet(),
    ),
    coldSelectorCaches: makeLazyGetter("coldSelectorCaches"),
    stateRevisions: makeLazyGetter("stateRevisions"),
    coldCacheValidationSet: makeLazyGetter(
        "coldCacheValidationSet",
        () => new WeakSet(),
    ),
    dependencyOrder: makeLazyGetter("dependencyOrder"),
    cycleRiskInClosure: makeLazyGetter("cycleRiskInClosure"),
    acyclicDependencyVersion: makeLazyGetter("acyclicDependencyVersion"),
    orphanCleanupVersion: makeLazyGetter("orphanCleanupVersion"),
    mounts: makeLazyGetter("mounts"),
    liveDependentCount: makeLazyGetter("liveDependentCount"),
    mountInClosure: makeLazyGetter("mountInClosure"),
    abortControllers: makeLazyGetter("abortControllers"),
    cache: makeLazyGetter("cache"),
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
    // Tree-wide state: a scope shares its root's object by reference, so no
    // store-tree lookup ever walks `parent`.
    data.tree = parent ? parent.tree : createStoreTreeRuntime(data)
    data.coldSelectorCachesEnabled = false
    data.nextDependencyOrder = 0
    data.dependencyGraphVersion = 0
    data.pendingOrphanCleanup = undefined
    data.orphanCleanupScheduled = false
    data.scopes = new Map()
    data.scopeValueIndex = new WeakMap()
    // Eager (not lazy) because resolvePendingDefault in setAtom walks every
    // store in the scope chain on every setAtom call. Lazy would still
    // allocate on first setAtom — eager just makes that explicit and avoids
    // touching the prototype getter on the hot path.
    data.pendingDefaults = new WeakMap()
    // Reserve the private runtime slot eagerly to keep StoreData's hidden class
    // stable. storeFromStoreData fills it immediately after creation.
    data[STORE_RUNTIME] = undefined
    // Same reason: a store that later acquires a cleanup, mount, or open
    // transaction must not transition its shape to gain the slot.
    data.resources = undefined
    // Liveness-pass scratch, initialized here (not added lazily during the first
    // pass) so the StoreData hidden class is fixed at construction. Otherwise the
    // first getDefault/propagation pass adds these fields at runtime, transitions
    // the object's V8 shape, and de-opts the inline caches on the adjacent atom
    // get/set hot path (a measurable ~25%/op V8-only regression on the atom
    // lifecycle path). `livenessPassActive` is the ownership token; `livenessSeeds`
    // is allocated lazily on first seed (undefined = unallocated).
    data.livenessPassActive = false
    data.livenessSeeds = undefined
    data.livenessRemovalArmed = false
    data.livenessLazyArmed = false
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
        data.inheritedDependencyKeys = undefined
        // Measurement windows attach this only in architecture tests. Scopes
        // created during a window participate in the same logical commit.
        if (parent.architectureInstrumentation) {
            data.architectureInstrumentation =
                parent.architectureInstrumentation
        }
    }
    return data
}
