import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { storeFromStoreData } from "./storeFromStoreData"

const hasDirectSubscribers = (state: State, data: StoreData): boolean => {
    const subs = data.subscriptions.get(state)
    return !!subs && subs.size > 0
}

/**
 * Cached liveness check. A state is "live" (transitively subscribed) iff it
 * has direct subscribers OR at least one of its dependents (selectors that
 * read it) is itself live. The "live dependent" contribution is tracked
 * incrementally in `data.liveDependentCount`, so this is O(1).
 */
export const isLive = (state: State, data: StoreData): boolean => {
    if (hasDirectSubscribers(state, data)) return true
    const count = data.liveDependentCount.get(state)
    return !!count && count > 0
}

/**
 * Propagate a "just became live" transition through the state's dependency
 * graph. For each dependency D of the state, the state itself counts as one
 * more live dependent of D. If that flips D from not-live to live, recurse.
 */
const propagateLive = (root: State, data: StoreData) => {
    const stack: State[] = [root]
    while (stack.length > 0) {
        const current = stack.pop()!
        const deps = data.stateDependencies.get(current)
        if (!deps) continue
        for (const dep of deps) {
            const prev = data.liveDependentCount.get(dep) ?? 0
            data.liveDependentCount.set(dep, prev + 1)
            if (prev === 0 && !hasDirectSubscribers(dep, data)) {
                stack.push(dep)
            }
        }
    }
}

/**
 * Propagate a "just became not-live" transition through the state's
 * dependency graph. Mirror of propagateLive.
 */
const propagateNotLive = (root: State, data: StoreData) => {
    const stack: State[] = [root]
    while (stack.length > 0) {
        const current = stack.pop()!
        const deps = data.stateDependencies.get(current)
        if (!deps) continue
        for (const dep of deps) {
            const prev = data.liveDependentCount.get(dep) ?? 0
            const next = prev - 1
            if (next <= 0) {
                data.liveDependentCount.delete(dep)
            } else {
                data.liveDependentCount.set(dep, next)
            }
            if (prev === 1 && !hasDirectSubscribers(dep, data)) {
                stack.push(dep)
            }
        }
    }
}

/**
 * Direct subscribers on `state` just transitioned from 0 → 1. If the state
 * wasn't already live via dependents, mark it live and propagate.
 */
export const onFirstDirectSubscriber = (state: State, data: StoreData) => {
    const liveDepCount = data.liveDependentCount.get(state) ?? 0
    if (liveDepCount === 0) {
        propagateLive(state, data)
    }
}

/**
 * Direct subscribers on `state` just transitioned from 1 → 0. If the state
 * has no live dependents either, it transitions to not-live and we
 * propagate.
 */
export const onLastDirectSubscriber = (state: State, data: StoreData) => {
    const liveDepCount = data.liveDependentCount.get(state) ?? 0
    if (liveDepCount === 0) {
        propagateNotLive(state, data)
    }
}

/**
 * A live selector gained dependency `dep`. Register the contribution to
 * dep's liveDependentCount; if dep transitions to live, propagate.
 */
export const onLiveDependencyAdded = (dep: State, data: StoreData) => {
    const prev = data.liveDependentCount.get(dep) ?? 0
    data.liveDependentCount.set(dep, prev + 1)
    if (prev === 0 && !hasDirectSubscribers(dep, data)) {
        propagateLive(dep, data)
    }
}

/**
 * A live selector lost dependency `dep`. Decrement and propagate not-live
 * if the contribution was the last one keeping dep alive.
 */
export const onLiveDependencyRemoved = (dep: State, data: StoreData) => {
    const prev = data.liveDependentCount.get(dep) ?? 0
    const next = prev - 1
    if (next <= 0) {
        data.liveDependentCount.delete(dep)
    } else {
        data.liveDependentCount.set(dep, next)
    }
    if (prev === 1 && !hasDirectSubscribers(dep, data)) {
        propagateNotLive(dep, data)
    }
}

/**
 * Mount a single atom: call its onMount and store the cleanup in data.mounts.
 * No-op if the atom has no onMount or is already mounted.
 *
 * Checks `__valdresOnMount` first (set by compat layers that need to wrap
 * the onMount signature), then falls back to `onMount`.
 */
export const mountAtom = (state: State, data: StoreData) => {
    const onMountFn = state.__valdresOnMount ?? state.onMount
    if (!onMountFn || data.mounts.has(state)) return
    // Mark as mounted BEFORE calling onMountFn to prevent reentrant mounts
    // (onMount may call setSelf which triggers propagation and dep changes)
    const mountEntry: { cleanup?: () => void } = {}
    data.mounts.set(state, mountEntry)
    const store = data.storeRef ?? storeFromStoreData(data)
    try {
        const result = onMountFn(store, state)
        if (typeof result === "function") mountEntry.cleanup = result
    } catch (error) {
        data.mounts.delete(state)
        throw error
    }
}

/**
 * Unmount a single atom: remove it from data.mounts and call its cleanup.
 * No-op if the atom is not mounted.
 */
export const unmountAtom = (state: State, data: StoreData) => {
    const mount = data.mounts.get(state)
    if (!mount) return
    data.mounts.delete(state)
    if (typeof mount.cleanup === "function") {
        mount.cleanup()
    }
}

/**
 * Walk the transitive dependencies of a state and mount any atoms that have
 * onMount. Called when a state gains its first transitive subscriber.
 * Uses an iterative approach to avoid stack overflow on deep dependency chains.
 * Continues mounting remaining atoms even if one throws, then re-throws
 * the first error.
 */
export const mountTransitiveDeps = (
    state: State,
    data: StoreData,
    visited?: Set<State>,
) => {
    // Fast path: leaf state with no onMount means there is nothing to mount
    // anywhere reachable from here. Skip the Set/Array allocation and walk.
    if (!state.__valdresOnMount && !state.onMount) {
        const deps = data.stateDependencies.get(state)
        if (!deps || deps.size === 0) return
    }
    const seen = visited ?? new Set<State>()
    let firstError: { value: unknown } | null = null
    const stack: State[] = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        if (seen.has(current)) continue
        seen.add(current)
        if (current.__valdresOnMount || current.onMount) {
            try {
                mountAtom(current, data)
            } catch (error) {
                if (!firstError) firstError = { value: error }
            }
        }
        const deps = data.stateDependencies.get(current)
        if (deps) {
            for (const dep of deps) {
                if (!seen.has(dep)) stack.push(dep)
            }
        }
    }
    if (firstError) {
        throw firstError.value
    }
}

/**
 * Check if a state should be unmounted (no longer transitively subscribed)
 * and unmount it if so. Uses iterative traversal for deep dependency chains.
 * Continues unmounting remaining atoms even if one throws, then re-throws
 * the first error.
 */
export const unmountOrphanedDeps = (
    state: State,
    data: StoreData,
    visited?: Set<State>,
) => {
    // Fast path: leaf state with no onMount can't have anything mounted
    // beneath it. Skip the Set/Array allocation and walk.
    if (!state.__valdresOnMount && !state.onMount) {
        const deps = data.stateDependencies.get(state)
        if (!deps || deps.size === 0) return
    }
    const seen = visited ?? new Set<State>()
    let firstError: { value: unknown } | null = null
    const stack: State[] = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        if (seen.has(current)) continue
        seen.add(current)
        if ((current.__valdresOnMount || current.onMount) && data.mounts.has(current)) {
            if (!isLive(current, data)) {
                try {
                    unmountAtom(current, data)
                } catch (error) {
                    if (!firstError) firstError = { value: error }
                }
            }
        }
        const deps = data.stateDependencies.get(current)
        if (deps) {
            for (const dep of deps) {
                if (!seen.has(dep)) stack.push(dep)
            }
        }
    }
    if (firstError) {
        throw firstError.value
    }
}
