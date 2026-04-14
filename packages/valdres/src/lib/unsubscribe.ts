import type { Family } from "../types/Family"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { getMaxAgeCleanup, deleteMaxAgeCleanup } from "./maxAgeCleanups"
import { isTransitivelySubscribed, unmountOrphanedDeps } from "./mountAtom"

export const unsubscribe = <V>(
    state: State<V> | Family<V>,
    subscription: Subscription,
    data: StoreData,
) => {
    const subscribers = data.subscriptions.get(state)
    if (subscribers) {
        subscribers.delete(subscription)
        if (data.subscriptionsRequireEqualCheck.get(state)) {
            let remove = true
            for (const subscriber of subscribers) {
                if (subscriber.requireDeepEqualCheckBeforeCallback) {
                    remove = false
                    break
                }
            }
            if (remove) {
                data.subscriptionsRequireEqualCheck.delete(state)
            }
        }
        if (subscribers.size === 0) {
            const maxAgeCleanup = getMaxAgeCleanup(data, state)
            if (maxAgeCleanup) {
                maxAgeCleanup()
                deleteMaxAgeCleanup(data, state)
            }
            data.subscriptions.delete(state)
            // Unmount this state and any transitive dependencies that are
            // no longer reachable from any subscriber.
            unmountOrphanedDeps(state as State<V>, data)
            // Clean up dependency graph for states that are no longer
            // transitively subscribed, allowing derived atoms/selectors
            // to be garbage collected.
            cleanupOrphanedDeps(state as State<V>, data)
        }
    }
}

/**
 * Remove a state from the dependency graph if it is no longer transitively
 * subscribed. For selectors (states with dependencies), this removes the state
 * from its dependencies' stateDependents sets and clears its own cached value.
 * Then recursively cleans up any orphaned dependents (selectors that read this
 * state and are themselves no longer transitively subscribed).
 *
 * On re-subscription the value will be re-evaluated and dependencies rebuilt.
 */
const cleanupOrphanedDeps = (
    state: State,
    data: StoreData,
    visited: Set<State> = new Set(),
) => {
    if (visited.has(state)) return
    visited.add(state)
    if (isTransitivelySubscribed(state, data)) return

    // For selectors: remove from dependencies' stateDependents and clear cache
    const deps = data.stateDependencies.get(state)
    if (deps) {
        for (const dep of deps) {
            const depDependents = data.stateDependents.get(dep)
            if (depDependents) {
                depDependents.delete(state)
            }
        }
        data.stateDependencies.delete(state)
        data.values.delete(state)
        data.abortControllers.delete(state)
    }

    // Recursively clean up orphaned dependents (selectors that read this state)
    const dependents = data.stateDependents.get(state)
    if (dependents) {
        for (const dep of [...dependents]) {
            cleanupOrphanedDeps(dep, data, visited)
        }
    }
}
