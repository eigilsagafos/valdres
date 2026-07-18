import type { Atom } from "../types/Atom"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { getState } from "./getState"
import {
    activateSelectorGraph,
    isLive,
    mountTransitiveDeps,
    noteDependencyAdded,
    onLiveDependencyAdded,
} from "./mountAtom"
import { noteDependencyGraphChanged } from "./noteDependencyGraphChanged"
import { noteStateValueChanged } from "./stateRevisions"

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
        if (data.selectorGraphActive.has(selector)) {
            noteDependencyGraphChanged(selector, data)
            const dependents = getOrInitDependentsSet(state, data)
            dependents.add(selector)
            // New edge: keep the mount-closure marker's no-false-negative invariant.
            noteDependencyAdded(selector, state, data)
        } else {
            // The dependency list no longer aligns with the cold cache's
            // revision array. Force validation/re-evaluation on the next read.
            const cache = data.coldSelectorCaches.get(selector)
            if (cache) cache.validatedAt = -1
        }
    }

    // Get the value (may throw for error-throwing selectors).
    // Atoms lazily initialized here are first-time accesses — no other
    // selector depends on them yet, so propagation is unnecessary.
    const lateInitSet = new Set<Atom>()
    try {
        return getState(state, data, lateInitSet)
    } finally {
        // Validate/read a cold selector before promoting its dependency graph;
        // promotion deliberately bypasses cold-cache validation thereafter.
        if (isNewDep && data.selectorGraphActive.has(selector)) {
            activateSelectorGraph(state, data)
            // Mount new dependencies if the selector is live.
            if (isLive(selector, data)) {
                onLiveDependencyAdded(state, data)
                mountTransitiveDeps(state, data)
            }
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
    noteStateValueChanged(selector, data)
}
