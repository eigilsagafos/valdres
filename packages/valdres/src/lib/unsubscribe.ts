import type { Family } from "../types/Family"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { isSelector } from "../utils/isSelector"
import { getMaxAgeCleanup, deleteMaxAgeCleanup } from "./maxAgeCleanups"
import {
    isLive,
    onLastDirectSubscriber,
    reconcileLivenessAfterChurn,
    regionHasCycle,
    unmountOrphanedDeps,
} from "./mountAtom"
import { queueOrphanCleanup } from "./queueOrphanCleanup"

export const unsubscribe = <V>(
    state: State<V> | Family<V>,
    subscription: Subscription,
    data: StoreData,
) => {
    const subscribers = data.subscriptions.get(state)
    if (subscribers?.delete(subscription)) {
        const equalCheckSubscriptions = data.subscriptionsRequireEqualCheck
        if (equalCheckSubscriptions.get(state)) {
            let remove = true
            for (const subscriber of subscribers) {
                if (subscriber.requireDeepEqualCheckBeforeCallback) {
                    remove = false
                    break
                }
            }
            if (remove) {
                equalCheckSubscriptions.set(state, undefined)
            }
        }
        if (subscribers.size === 0) {
            equalCheckSubscriptions.delete(state)
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
            // Cyclic liveness is reconciled synchronously so onUnmount semantics
            // remain eager. Negative cycle proofs are topology-versioned: across
            // a deletion-only sibling burst, each shared acyclic closure is
            // scanned once total instead of once per unsubscribe.
            if (
                isSelector(state) &&
                data.cycleRiskInClosure.has(state as State<V>) &&
                regionHasCycle(state as State<V>, data)
            ) {
                // Reconciliation can synchronously unmount a cyclic region, so
                // its user cleanup needs the same exception-safe graph queue.
                try {
                    reconcileLivenessAfterChurn(
                        new Set([state as State<V>]),
                        data,
                    )
                } catch (error) {
                    if (!isLive(state as State<V>, data)) {
                        queueOrphanCleanup(state as State<V>, data)
                    }
                    throw error
                }
            }
            // A live state keeps its full downward dependency closure live, so
            // neither orphan walk can do work. This is especially important for
            // wide fan-in: sibling subscriptions disappear while an aggregator
            // still keeps every shared branch live.
            if (!isLive(state as State<V>, data)) {
                try {
                    // User-visible lifecycle cleanup stays synchronous.
                    unmountOrphanedDeps(state as State<V>, data)
                } finally {
                    // Graph/value cleanup is intentionally microtask-batched so
                    // sibling roots share completed visits. Every public store
                    // operation flushes it first, preserving API-level cache
                    // reads. Queue even when user lifecycle cleanup throws.
                    queueOrphanCleanup(state as State<V>, data)
                }
            }
        }
    }
}
