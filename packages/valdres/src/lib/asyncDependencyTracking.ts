import type { Atom } from "../types/Atom"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { getState } from "./getState"
import { isLive, mountTransitiveDeps, onLiveDependencyAdded } from "./mountAtom"

// Tracks all deps (sync + async) for each pending async selector evaluation.
// Keyed by the Promise returned by the async selector. When the promise
// resolves, handleSelectorResult reads this to reconcile stale deps.
export const pendingAsyncDeps = new WeakMap<Promise<any>, Set<State>>()

export class SuspendAndWaitForResolveError extends Error {
    promise: Promise<any>
    constructor(promise: Promise<any>) {
        super()
        this.promise = promise
    }
}

/** Type guard for SuspendAndWaitForResolveError. Exported so consumers
 *  (e.g. the jotai adapter) can detect suspension without importing the class. */
export const isSuspendError = (
    e: unknown,
): e is { promise: Promise<any> } => {
    return e instanceof SuspendAndWaitForResolveError
}

export const getOrInitDependentsSet = (
    state: State,
    data: StoreData,
): Set<State<any>> => {
    const set = data.stateDependents.get(state)
    if (set) return set
    const newSet = new Set<State>()
    data.stateDependents.set(state, newSet)
    return newSet
}

/**
 * Handle a deferred `get` call — one that runs after the synchronous
 * evaluation of the selector has already completed (e.g. inside a
 * setTimeout or after an await). Registers the dependency, mounts it
 * if the selector is transitively subscribed, and returns the value.
 */
export const lateGet = (
    state: State,
    selector: Selector,
    data: StoreData,
) => {
    // Register dependency
    let deps = data.stateDependencies.get(selector)
    if (!deps) {
        deps = new Set()
        data.stateDependencies.set(selector, deps)
    }
    const isNewDep = !deps.has(state)
    if (isNewDep) {
        deps.add(state)
        const dependents = getOrInitDependentsSet(state, data)
        dependents.add(selector)
    }

    // Get the value (may throw for error-throwing selectors).
    // Atoms lazily initialized here are first-time accesses — no other
    // selector depends on them yet, so propagation is unnecessary.
    const lateInitSet = new Set<Atom>()
    try {
        return getState(state, data, lateInitSet)
    } finally {
        // Mount new dependencies if the selector is live
        if (isNewDep && isLive(selector, data)) {
            onLiveDependencyAdded(state, data)
            mountTransitiveDeps(state, data)
        }
    }
}

export const cleanUpRejectedPromise = <Value>(
    selector: Selector<Value>,
    data: StoreData,
    promise: Promise<any>,
) => {
    if (data.values.has(selector) && data.values.get(selector) !== promise) return
    data.values.delete(selector)
}
