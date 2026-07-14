import type { Family } from "../types/Family"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { getMaxAgeCleanup, deleteMaxAgeCleanup } from "./maxAgeCleanups"
import { isLive, onLastDirectSubscriber, reconcileLivenessAfterChurn, regionHasCycle, unmountOrphanedDeps } from "./mountAtom"
import { isSelector } from "../utils/isSelector"

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
            // Last direct subscriber removed: if there are no live dependents
            // either, the state transitions to not-live and we propagate to
            // its dependencies. Done before unmount/cleanup so subsequent
            // isLive checks reflect the updated liveness.
            onLastDirectSubscriber(state as State<V>, data)
            // The incremental teardown (propagateNotLive) cannot collect cyclic
            // dependency groups — their mutual contributions keep each other's
            // count > 0 once the anchor leaves. Reconcile from ground-truth
            // reachability so a cyclic subtree that lost its only subscriber is
            // marked non-live. Needed ONLY when a cycle is present, and a cycle is
            // selector-only (only selectors are keyed in stateDependencies; atoms
            // and atom-family members are graph sinks), so unsubscribing an atom
            // can skip in O(1) without even building a region. For a selector,
            // the sticky `depGraphMaybeCyclic` flag (maintained at edge-commit
            // time by probeForDependencyCycle) short-circuits first: while no
            // cycle was ever committed to this store, regionHasCycle is
            // guaranteed false, so the O(closure) walk — previously paid on
            // EVERY selector unsubscribe, making synchronous teardown bursts
            // O(unsubs × shared closure) — is skipped outright. Once the flag
            // is set, the exact per-region gate runs as before (acyclic region →
            // propagateNotLive already drained the counts exactly → skip the
            // O(region+dependents) reconcile).
            if (
                data.depGraphMaybeCyclic &&
                isSelector(state) &&
                regionHasCycle(new Set([state as State<V>]), data)
            ) {
                reconcileLivenessAfterChurn(new Set([state as State<V>]), data)
            }
            // A state still live via dependents keeps its entire downward
            // closure live (each dep holds a positive liveDependentCount from
            // its live dependent), so both orphan sweeps below are no-ops —
            // skip them without allocating. Counts are trustworthy here: either
            // the reconcile above just ground-truthed them, or the region is
            // acyclic and the incremental bookkeeping is exact.
            if (!isLive(state as State<V>, data)) {
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
) => {
    const visited = new Set<State>()
    const stack = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        if (visited.has(current)) continue
        visited.add(current)
        if (isLive(current, data)) continue

        const dependents = data.stateDependents.get(current)

        // For selectors: remove from dependencies' stateDependents and clear
        // cache. Then walk those dependencies too: removing `current` may have
        // been the last live edge keeping an intermediate selector materialized.
        const deps = data.stateDependencies.get(current)
        if (deps) {
            for (const dep of deps) {
                const depDependents = data.stateDependents.get(dep)
                if (depDependents) {
                    depDependents.delete(current)
                }
            }
            data.stateDependencies.delete(current)
            data.values.delete(current)
            data.abortControllers.delete(current)

            if (dependents) {
                for (const dep of dependents) {
                    stack.push(dep)
                }
            }
            for (const dep of deps) {
                stack.push(dep)
            }
            continue
        }

        // Clean up orphaned dependents (selectors that read this state).
        if (dependents) {
            for (const dep of dependents) {
                stack.push(dep)
            }
        }
    }
}
