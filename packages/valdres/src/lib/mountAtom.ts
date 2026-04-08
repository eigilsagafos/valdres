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
    const stack: State[] = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        if (visited.has(current)) continue
        visited.add(current)
        const subs = data.subscriptions.get(current)
        if (subs && subs.size > 0) return true
        const dependents = data.stateDependents.get(current)
        if (dependents) {
            for (const dep of dependents) {
                if (!visited.has(dep)) stack.push(dep)
            }
        }
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
 * Uses an iterative approach to avoid stack overflow on deep dependency chains.
 * Continues mounting remaining atoms even if one throws, then re-throws
 * the first error.
 */
export const mountTransitiveDeps = (
    state: State,
    data: StoreData,
    visited: Set<State> = new Set(),
) => {
    let firstError: { value: unknown } | null = null
    const stack: State[] = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        if (visited.has(current)) continue
        visited.add(current)
        // @ts-ignore
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
                if (!visited.has(dep)) stack.push(dep)
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
    visited: Set<State> = new Set(),
) => {
    let firstError: { value: unknown } | null = null
    const stack: State[] = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        if (visited.has(current)) continue
        visited.add(current)
        // @ts-ignore
        if ((current.__valdresOnMount || current.onMount) && data.mounts.has(current)) {
            if (!isTransitivelySubscribed(current, data)) {
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
                if (!visited.has(dep)) stack.push(dep)
            }
        }
    }
    if (firstError) {
        throw firstError.value
    }
}
