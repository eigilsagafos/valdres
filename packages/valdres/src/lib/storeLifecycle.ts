import { StoreDisposedError } from "../errors/StoreDisposedError"
import type { InternalGlobalAtom } from "../types/InternalGlobalAtom"
import type { State } from "../types/State"
import type { Store } from "../types/Store"
import type { StoreData } from "../types/StoreData"
import { STORE_RUNTIME } from "./storeRuntimeKey"
import type { TransactionContext } from "./transaction"

/**
 * Resource collections are allocated only when the store acquires a resource.
 * StoreData stays unchanged because it sits on every atom hot path.
 */
export type StoreResources = {
    disposed?: true
    globals?: Set<InternalGlobalAtom<any>>
    cleanups?: Set<() => void>
    mounts?: Set<State>
    abortControllers?: Set<AbortController>
    transactions?: TransactionContext | Set<TransactionContext>
}

export const DISPOSED_STORE_LIFECYCLE = Symbol("valdres.disposedStore")
export const DISPOSED_STORE_PENDING = new Set<WeakKey>()
export const STORE_LIFECYCLE = Symbol("valdres.storeLifecycle")
const PENDING_STORE_LIFECYCLE = Symbol("valdres.pendingStoreLifecycle")

export type StoreLifecycle =
    | StoreResources
    | typeof DISPOSED_STORE_LIFECYCLE
    | undefined

export type PendingStoreLifecycle = {
    [PENDING_STORE_LIFECYCLE]: true
    disposed?: true
    resources?: StoreResources
}

type LifecycleStore = Store & { [STORE_LIFECYCLE]?: StoreLifecycle }
type RuntimeSlot = LifecycleStore | PendingStoreLifecycle
type RuntimeData = StoreData & { [STORE_RUNTIME]?: RuntimeSlot }
const disposedStoreTokens = new WeakMap<StoreData, object>()
const disposedErrorTokens = new WeakMap<StoreDisposedError, object>()

const slotFor = (data: StoreData): RuntimeSlot | undefined =>
    (data as RuntimeData)[STORE_RUNTIME]

export const isPendingStoreLifecycle = (
    value: Store | PendingStoreLifecycle,
): value is PendingStoreLifecycle =>
    (value as PendingStoreLifecycle)[PENDING_STORE_LIFECYCLE] === true

/** Convert state recorded before a facade existed into its facade slot. */
export const lifecycleFromPendingStore = (
    pending: PendingStoreLifecycle,
): StoreLifecycle => {
    const resources = pending.resources
    if (!pending.disposed) return resources
    if (!resources) return DISPOSED_STORE_LIFECYCLE
    resources.disposed = true
    return resources
}

const runtimeFor = (data: StoreData): LifecycleStore | undefined => {
    const slot = slotFor(data)
    return slot && !isPendingStoreLifecycle(slot) ? slot : undefined
}

const pendingFor = (data: StoreData): PendingStoreLifecycle | undefined => {
    const slot = slotFor(data)
    return slot && isPendingStoreLifecycle(slot) ? slot : undefined
}

const resourcesFor = (data: StoreData): StoreResources | undefined => {
    const pending = pendingFor(data)
    if (pending) return pending.resources
    const lifecycle = runtimeFor(data)?.[STORE_LIFECYCLE]
    return lifecycle && lifecycle !== DISPOSED_STORE_LIFECYCLE
        ? lifecycle
        : undefined
}

const getOrCreateStoreResources = (data: StoreData): StoreResources => {
    let resources = resourcesFor(data)
    if (resources) return resources
    resources = {}
    const runtime = runtimeFor(data)
    if (runtime) {
        runtime[STORE_LIFECYCLE] = resources
        return resources
    }
    const pending = pendingFor(data) ?? {
        [PENDING_STORE_LIFECYCLE]: true as const,
    }
    pending.resources = resources
    ;(data as RuntimeData)[STORE_RUNTIME] = pending
    return resources
}

export const isStoreDisposed = (data: StoreData): boolean => {
    const pending = pendingFor(data)
    if (pending) return pending.disposed === true
    const lifecycle = runtimeFor(data)?.[STORE_LIFECYCLE]
    return (
        lifecycle === DISPOSED_STORE_LIFECYCLE ||
        (lifecycle !== undefined && lifecycle.disposed === true)
    )
}

export const markStoreDisposed = (
    data: StoreData,
    disposalToken: object,
): void => {
    disposedStoreTokens.set(data, disposalToken)
    const pending = pendingFor(data)
    if (pending) {
        pending.disposed = true
        if (pending.resources) pending.resources.disposed = true
        return
    }
    const runtime = runtimeFor(data)
    if (runtime) {
        const lifecycle = runtime[STORE_LIFECYCLE]
        if (lifecycle === DISPOSED_STORE_LIFECYCLE) return
        if (lifecycle) lifecycle.disposed = true
        else runtime[STORE_LIFECYCLE] = DISPOSED_STORE_LIFECYCLE
        return
    }
    ;(data as RuntimeData)[STORE_RUNTIME] = {
        [PENDING_STORE_LIFECYCLE]: true,
        disposed: true,
    }
}

/** Release the drained resource object while retaining the terminal marker. */
export const releaseStoreResources = (data: StoreData): void => {
    const pending = pendingFor(data)
    if (pending) {
        pending.resources = undefined
        return
    }
    const runtime = runtimeFor(data)
    const lifecycle = runtime?.[STORE_LIFECYCLE]
    if (
        runtime &&
        lifecycle &&
        lifecycle !== DISPOSED_STORE_LIFECYCLE &&
        lifecycle.disposed
    ) {
        runtime[STORE_LIFECYCLE] = DISPOSED_STORE_LIFECYCLE
    }
}

export const createStoreDisposedError = (
    data: StoreData,
): StoreDisposedError => {
    const error = new StoreDisposedError(data.id)
    const token = disposedStoreTokens.get(data)
    if (token) disposedErrorTokens.set(error, token)
    return error
}

export const getStoreDisposedErrorToken = (
    error: unknown,
): object | undefined =>
    error instanceof StoreDisposedError
        ? disposedErrorTokens.get(error)
        : undefined

export const trackTouchedGlobal = (
    data: StoreData,
    atom: InternalGlobalAtom<any>,
): boolean => {
    if (isStoreDisposed(data)) return false
    const resources = getOrCreateStoreResources(data)
    ;(resources.globals ??= new Set()).add(atom)
    return true
}

export const untrackTouchedGlobal = (
    data: StoreData,
    atom: InternalGlobalAtom<any>,
): void => {
    const resources = resourcesFor(data)
    const globals = resources?.globals
    if (!globals) return
    globals.delete(atom)
    if (globals.size === 0) resources.globals = undefined
}

export const getTouchedGlobals = (
    data: StoreData,
): ReadonlySet<InternalGlobalAtom<any>> | undefined =>
    resourcesFor(data)?.globals

/**
 * Register an idempotent resource disposer. Registration after terminal
 * disposal unwinds immediately. Callers remove themselves when run manually.
 */
export const trackStoreCleanup = (
    data: StoreData,
    cleanup: () => void,
): (() => void) => {
    if (isStoreDisposed(data)) {
        cleanup()
        return cleanup
    }
    const resources = getOrCreateStoreResources(data)
    ;(resources.cleanups ??= new Set()).add(cleanup)
    return cleanup
}

/** Stop tracking a resource that completed normally, without running it. */
export const untrackStoreCleanup = (
    data: StoreData,
    cleanup: () => void,
): void => {
    const resources = resourcesFor(data)
    const cleanups = resources?.cleanups
    if (!cleanups) return
    cleanups.delete(cleanup)
    if (cleanups.size === 0) resources.cleanups = undefined
}

/** Transfer ownership of the current disposer set to the disposal pass. */
export const takeStoreCleanups = (
    data: StoreData,
): Set<() => void> | undefined => {
    const resources = resourcesFor(data)
    const cleanups = resources?.cleanups
    if (resources) resources.cleanups = undefined
    return cleanups
}

/** Register an open transaction with its backing store. The common case stores
 * one context directly; only concurrent adapter transactions allocate a Set.
 * Returning the resource owner lets commit untrack without a second runtime
 * lookup while preserving StoreData's performance-critical object shape. */
export const trackStoreTransaction = (
    data: StoreData,
    transaction: TransactionContext,
): StoreResources | undefined => {
    const slot = slotFor(data)
    let resources: StoreResources
    if (!slot) {
        resources = {}
        ;(data as RuntimeData)[STORE_RUNTIME] = {
            [PENDING_STORE_LIFECYCLE]: true,
            resources,
        }
    } else if (isPendingStoreLifecycle(slot)) {
        if (slot.disposed) return
        resources = slot.resources ?? (slot.resources = {})
    } else {
        const lifecycle = slot[STORE_LIFECYCLE]
        if (lifecycle === DISPOSED_STORE_LIFECYCLE || lifecycle?.disposed) {
            return
        }
        if (lifecycle) resources = lifecycle
        else {
            resources = {}
            slot[STORE_LIFECYCLE] = resources
        }
    }
    const current = resources.transactions
    if (!current) resources.transactions = transaction
    else if (current instanceof Set) current.add(transaction)
    else if (current !== transaction) {
        resources.transactions = new Set([current, transaction])
    }
    return resources
}

export const untrackStoreTransaction = (
    resources: StoreResources,
    transaction: TransactionContext,
): void => {
    const current = resources.transactions
    if (current === transaction) {
        resources.transactions = undefined
        return
    }
    if (!(current instanceof Set)) return
    current.delete(transaction)
    if (current.size === 1) {
        resources.transactions = current.values().next().value
    } else if (current.size === 0) resources.transactions = undefined
}

/** Transfer open adapter transactions to the disposal pass. */
export const takeStoreTransactions = (
    data: StoreData,
): TransactionContext | Set<TransactionContext> | undefined => {
    const resources = resourcesFor(data)
    const transactions = resources?.transactions
    if (resources) resources.transactions = undefined
    return transactions
}

export const trackStoreMount = (data: StoreData, state: State): boolean => {
    if (isStoreDisposed(data)) return false
    const resources = getOrCreateStoreResources(data)
    ;(resources.mounts ??= new Set()).add(state)
    return true
}

export const untrackStoreMount = (data: StoreData, state: State): void => {
    const resources = resourcesFor(data)
    const mounts = resources?.mounts
    if (!mounts) return
    mounts.delete(state)
    if (mounts.size === 0) resources.mounts = undefined
}

export const takeStoreMounts = (data: StoreData): Set<State> | undefined => {
    const resources = resourcesFor(data)
    const mounts = resources?.mounts
    if (resources) resources.mounts = undefined
    return mounts
}

export const trackAbortController = (
    data: StoreData,
    controller: AbortController,
): void => {
    if (isStoreDisposed(data)) {
        controller.abort()
        return
    }
    const resources = getOrCreateStoreResources(data)
    ;(resources.abortControllers ??= new Set()).add(controller)
}

export const untrackAbortController = (
    data: StoreData,
    controller: AbortController | false | undefined,
): void => {
    if (!controller) return
    const resources = resourcesFor(data)
    const controllers = resources?.abortControllers
    if (!controllers) return
    controllers.delete(controller)
    if (controllers.size === 0) resources.abortControllers = undefined
}

export const takeAbortControllers = (
    data: StoreData,
): Set<AbortController> | undefined => {
    const resources = resourcesFor(data)
    const controllers = resources?.abortControllers
    if (resources) resources.abortControllers = undefined
    return controllers
}

/**
 * Development/test-only: read a store's live resource collections without
 * draining them. Consumed exclusively by the invariant checker in tests
 * (test/invariants/checkStoreInvariants.ts); every production caller uses the
 * typed track/untrack/take helpers above, so no ordinary path enumerates these
 * sets or pays for this accessor. Returned object is read-only by contract.
 */
export const peekStoreResources = (
    data: StoreData,
): Readonly<StoreResources> | undefined => resourcesFor(data)
