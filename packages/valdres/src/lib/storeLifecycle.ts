import { StoreDisposedError } from "../errors/StoreDisposedError"
import type { InternalGlobalAtom } from "../types/InternalGlobalAtom"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { StoreCancellable } from "./storeCancellableKey"
import { CANCEL_ON_STORE_DISPOSE } from "./storeCancellableKey"
import { valdresGlobal } from "./valdresGlobal"

/**
 * The store's resource ledger: everything acquired at runtime that disposal has
 * to release, plus the store's terminal status.
 *
 * It lives in `StoreData.resources` — one slot, reserved eagerly as `undefined`
 * by `createStoreData` so acquiring the first resource never transitions the
 * store's hidden class, and allocated only when a resource actually arrives.
 * Deliberately NOT on the public facade: hanging it off the `Store` object
 * (as this module used to) mutated the shape of the very object handed to user
 * `onSet`/`onMount` hooks, and forced a second "resources acquired before a
 * facade existed" slot to be resolved on every access.
 *
 * This module is the ONLY writer of `data.resources`. Every other module goes
 * through the track/untrack/take helpers below, so the drained-and-disposed
 * sentinel can never be resurrected or mutated.
 */
export type StoreResources = {
    disposed?: true
    globals?: Set<InternalGlobalAtom<any>>
    cleanups?: Set<() => void>
    mounts?: Set<State>
    abortControllers?: Set<AbortController>
    /** Open resources that must be cancelled if the store is disposed —
     *  transactions today, addressed only through `CANCEL_ON_STORE_DISPOSE` so
     *  lifecycle code never names their type. The common case holds one
     *  directly; only concurrent adapter transactions allocate a Set. */
    cancellables?: StoreCancellable | Set<StoreCancellable>
}

/** Terminal marker retained after the resource object has been drained and
 *  released. A symbol (not an object) so the type system forces every reader to
 *  narrow before touching a field — the sentinel is shared process-wide and
 *  must never be mutated. */
export const DISPOSED_STORE_RESOURCES: unique symbol = Symbol.for(
    "valdres.disposedStore",
)
export const DISPOSED_STORE_PENDING =
    valdresGlobal().runtime.disposedStorePending

export type StoreLifecycle =
    | StoreResources
    | typeof DISPOSED_STORE_RESOURCES
    | undefined

const { disposedStoreTokens, disposedErrorTokens } = valdresGlobal().runtime

/** Live resources, or undefined once the store reached its terminal marker. */
const resourcesFor = (data: StoreData): StoreResources | undefined => {
    const resources = data.resources
    return resources === DISPOSED_STORE_RESOURCES ? undefined : resources
}

/** Allocate the ledger on first use. Callers MUST have ruled out disposal
 *  first — the guard here is structural, so a future caller that forgets can
 *  never replace the terminal sentinel with a fresh, live ledger. */
const getOrCreateStoreResources = (
    data: StoreData,
): StoreResources | undefined => {
    const resources = data.resources
    if (resources === DISPOSED_STORE_RESOURCES) return undefined
    if (resources) return resources.disposed ? undefined : resources
    const created: StoreResources = {}
    data.resources = created
    return created
}

export const isStoreDisposed = (data: StoreData): boolean => {
    const resources = data.resources
    if (resources === undefined) return false
    if (resources === DISPOSED_STORE_RESOURCES) return true
    return resources.disposed === true
}

export const markStoreDisposed = (
    data: StoreData,
    disposalToken: object,
): void => {
    disposedStoreTokens.set(data, disposalToken)
    const resources = data.resources
    if (resources === DISPOSED_STORE_RESOURCES) return
    if (resources) resources.disposed = true
    else data.resources = DISPOSED_STORE_RESOURCES
}

/** Release the drained resource object while retaining the terminal marker.
 *  Never writes `undefined`: that would report the store as live again. */
export const releaseStoreResources = (data: StoreData): void => {
    const resources = data.resources
    if (resources !== DISPOSED_STORE_RESOURCES && resources?.disposed) {
        data.resources = DISPOSED_STORE_RESOURCES
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
    const resources = getOrCreateStoreResources(data)
    if (!resources) return false
    ;(resources.globals ??= new Set()).add(atom)
    return true
}

export const untrackTouchedGlobal = (
    data: StoreData,
    atom: InternalGlobalAtom<any>,
): void => {
    const resources = resourcesFor(data)
    if (!resources) return
    const globals = resources.globals
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
    const resources = getOrCreateStoreResources(data)
    if (!resources) {
        cleanup()
        return cleanup
    }
    ;(resources.cleanups ??= new Set()).add(cleanup)
    return cleanup
}

/** Stop tracking a resource that completed normally, without running it. */
export const untrackStoreCleanup = (
    data: StoreData,
    cleanup: () => void,
): void => {
    const resources = resourcesFor(data)
    if (!resources) return
    const cleanups = resources.cleanups
    if (!cleanups) return
    cleanups.delete(cleanup)
    if (cleanups.size === 0) resources.cleanups = undefined
}

/** Transfer ownership of the current disposer set to the disposal pass. */
export const takeStoreCleanups = (
    data: StoreData,
): Set<() => void> | undefined => {
    const resources = resourcesFor(data)
    if (!resources) return undefined
    const cleanups = resources.cleanups
    resources.cleanups = undefined
    return cleanups
}

/** Register something to cancel if the store is disposed — an open transaction
 * today. Returns false when the store is already terminal, which is the signal
 * the caller uses to close itself immediately. */
export const trackStoreCancellable = (
    data: StoreData,
    cancellable: StoreCancellable,
): boolean => {
    const resources = getOrCreateStoreResources(data)
    if (!resources) return false
    const current = resources.cancellables
    if (!current) resources.cancellables = cancellable
    else if (current instanceof Set) current.add(cancellable)
    else if (current !== cancellable) {
        resources.cancellables = new Set([current, cancellable])
    }
    return true
}

export const untrackStoreCancellable = (
    data: StoreData,
    cancellable: StoreCancellable,
): void => {
    const resources = resourcesFor(data)
    if (!resources) return
    const current = resources.cancellables
    if (current === cancellable) {
        resources.cancellables = undefined
        return
    }
    if (!(current instanceof Set)) return
    current.delete(cancellable)
    if (current.size === 1) {
        resources.cancellables = current.values().next().value
    } else if (current.size === 0) resources.cancellables = undefined
}

/** Transfer open cancellables to the disposal pass. */
export const takeStoreCancellables = (
    data: StoreData,
): StoreCancellable | Set<StoreCancellable> | undefined => {
    const resources = resourcesFor(data)
    if (!resources) return undefined
    const cancellables = resources.cancellables
    resources.cancellables = undefined
    return cancellables
}

/** Cancel whatever `takeStoreCancellables` handed back, reporting each failure
 *  without letting it stop the rest. */
export const cancelStoreCancellables = (
    cancellables: StoreCancellable | Set<StoreCancellable>,
    onError: (error: unknown) => void,
): void => {
    const cancel = (cancellable: StoreCancellable) => {
        try {
            cancellable[CANCEL_ON_STORE_DISPOSE]()
        } catch (error) {
            onError(error)
        }
    }
    if (cancellables instanceof Set) {
        for (const cancellable of cancellables) cancel(cancellable)
    } else cancel(cancellables)
}

export const trackStoreMount = (data: StoreData, state: State): boolean => {
    const resources = getOrCreateStoreResources(data)
    if (!resources) return false
    ;(resources.mounts ??= new Set()).add(state)
    return true
}

export const untrackStoreMount = (data: StoreData, state: State): void => {
    const resources = resourcesFor(data)
    if (!resources) return
    const mounts = resources.mounts
    if (!mounts) return
    mounts.delete(state)
    if (mounts.size === 0) resources.mounts = undefined
}

export const takeStoreMounts = (data: StoreData): Set<State> | undefined => {
    const resources = resourcesFor(data)
    if (!resources) return undefined
    const mounts = resources.mounts
    resources.mounts = undefined
    return mounts
}

export const trackAbortController = (
    data: StoreData,
    controller: AbortController,
): void => {
    const resources = getOrCreateStoreResources(data)
    if (!resources) {
        controller.abort()
        return
    }
    ;(resources.abortControllers ??= new Set()).add(controller)
}

export const untrackAbortController = (
    data: StoreData,
    controller: AbortController | false | undefined,
): void => {
    if (!controller) return
    const resources = resourcesFor(data)
    if (!resources) return
    const controllers = resources.abortControllers
    if (!controllers) return
    controllers.delete(controller)
    if (controllers.size === 0) resources.abortControllers = undefined
}

export const takeAbortControllers = (
    data: StoreData,
): Set<AbortController> | undefined => {
    const resources = resourcesFor(data)
    if (!resources) return undefined
    const controllers = resources.abortControllers
    resources.abortControllers = undefined
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
