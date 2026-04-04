import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { storeFromStoreData } from "./storeFromStoreData"

/**
 * Checks if a state is transitively subscribed — meaning it either has direct
 * subscribers, or at least one of its dependents (selectors that read it) is
 * itself transitively subscribed.
 */
export const isTransitivelySubscribed = (
    state: State,
    data: StoreData,
    visited: Set<State> = new Set(),
): boolean => {
    if (visited.has(state)) return false
    visited.add(state)
    const subs = data.subscriptions.get(state)
    if (subs && subs.size > 0) return true
    const dependents = data.stateDependents.get(state)
    if (!dependents) return false
    for (const dep of dependents) {
        if (isTransitivelySubscribed(dep, data, visited)) return true
    }
    return false
}

/**
 * Mount a single atom: call its onMount and store the cleanup in data.mounts.
 * No-op if the atom has no onMount or is already mounted.
 *
 * Checks `__valdresOnMount` first (set by compat layers that need to wrap
 * the onMount signature), then falls back to `onMount`.
 */
export const mountAtom = (state: State, data: StoreData) => {
    // @ts-ignore
    const onMountFn = state.__valdresOnMount ?? state.onMount
    if (!onMountFn || data.mounts.has(state)) return
    // Mark as mounted BEFORE calling onMountFn to prevent reentrant mounts
    // (onMount may call setSelf which triggers propagation and dep changes)
    const mountEntry: { cleanup?: () => void } = {}
    data.mounts.set(state, mountEntry)
    const store = data.storeRef ?? storeFromStoreData(data)
    try {
        mountEntry.cleanup = onMountFn(store, state)
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
 */
export const mountTransitiveDeps = (
    state: State,
    data: StoreData,
    visited: Set<State> = new Set(),
) => {
    if (visited.has(state)) return
    visited.add(state)
    // Mount this state itself if it's an atom with onMount
    // @ts-ignore
    if (state.__valdresOnMount || state.onMount) {
        mountAtom(state, data)
    }
    // Recurse into dependencies (for selectors)
    const deps = data.stateDependencies.get(state)
    if (deps) {
        for (const dep of deps) {
            mountTransitiveDeps(dep, data, visited)
        }
    }
}

/**
 * Check if a state should be unmounted (no longer transitively subscribed)
 * and unmount it if so. Recurses into its dependencies.
 */
export const unmountOrphanedDeps = (
    state: State,
    data: StoreData,
    visited: Set<State> = new Set(),
) => {
    if (visited.has(state)) return
    visited.add(state)
    // @ts-ignore
    if ((state.__valdresOnMount || state.onMount) && data.mounts.has(state)) {
        if (!isTransitivelySubscribed(state, data)) {
            unmountAtom(state, data)
        }
    }
    const deps = data.stateDependencies.get(state)
    if (deps) {
        for (const dep of deps) {
            unmountOrphanedDeps(dep, data, visited)
        }
    }
}
