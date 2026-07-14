import type { Family } from "../types/Family"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { isSelector } from "../utils/isSelector"
import { getMaxAgeCleanup, deleteMaxAgeCleanup } from "./maxAgeCleanups"
import {
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
            // Cyclic liveness is reconciled synchronously so onUnmount semantics
            // remain eager. Negative cycle proofs are topology-versioned: across
            // a deletion-only sibling burst, each shared acyclic closure is
            // scanned once total instead of once per unsubscribe.
            if (
                isSelector(state) &&
                data.cycleRiskInClosure.has(state as State<V>) &&
                regionHasCycle(state as State<V>, data)
            ) {
                reconcileLivenessAfterChurn(new Set([state as State<V>]), data)
            }
            // Unmount this state and any transitive dependencies that are
            // no longer reachable from any subscriber.
            unmountOrphanedDeps(state as State<V>, data)
            // Graph/value cleanup has no user-visible lifecycle callback. Batch
            // it across the synchronous burst so sibling roots share completed
            // visits and the calling stack pays only liveness + eager unmount.
            queueOrphanCleanup(state as State<V>, data)
        }
    }
}
