import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { isSelector } from "../utils/isSelector"
import { cacheController } from "./cacheController"
import {
    isLive,
    onLastDirectSubscriber,
    queueOrphanCleanup,
    reconcileLivenessAfterChurn,
    regionHasCycle,
    unmountOrphanedDeps,
} from "./graph"

const equalCheckCount = Symbol()
type CountedSubscriptions = Set<Subscription> & {
    [equalCheckCount]?: number
}

// Keep the equality flag map accurate without a survivor scan or a second state
// index: the subscription Set already has exactly the lifetime and identity
// needed to own the private O(1) count.
export const addSubscriptionEqualCheck = (
    state: State,
    subscriptions: Set<Subscription>,
    data: StoreData,
) => {
    const countedSubscriptions = subscriptions as CountedSubscriptions
    const count = countedSubscriptions[equalCheckCount] ?? 0
    if (count === 0) {
        countedSubscriptions[equalCheckCount] = 1
        data.subscriptionsRequireEqualCheck.set(state, true)
        return
    }
    countedSubscriptions[equalCheckCount] = count + 1
}

const removeSubscriptionEqualCheck = (
    state: State,
    subscriptions: Set<Subscription>,
    data: StoreData,
) => {
    const countedSubscriptions = subscriptions as CountedSubscriptions
    const count = countedSubscriptions[equalCheckCount]
    if (count === undefined) return
    if (count === 1) {
        // Retain the Set's shape; the Set itself is discarded with its last
        // subscriber, and a later equality subscription can reuse this slot.
        countedSubscriptions[equalCheckCount] = 0
        // A key with an undefined value remains disposal's active-state index.
        // The final-unsubscribe path below deletes the key outright.
        if (subscriptions.size !== 0) {
            data.subscriptionsRequireEqualCheck.set(state, undefined)
        }
        return
    }
    countedSubscriptions[equalCheckCount] = count - 1
}

export const unsubscribe = <V>(
    state: State<V>,
    subscription: Subscription,
    data: StoreData,
) => {
    const subscribers = data.subscriptions.get(state)
    if (subscribers) {
        const wasSubscribed = subscribers.delete(subscription)
        if (wasSubscribed && subscription.requireDeepEqualCheckBeforeCallback) {
            removeSubscriptionEqualCheck(state, subscribers, data)
        }
        if (subscribers.size === 0) {
            data.subscriptionsRequireEqualCheck.delete(state)
            cacheController.release(state, data)
            data.subscriptions.delete(state)
            // Last direct subscriber removed: if there are no live dependents
            // either, the state transitions to not-live and we propagate to
            // its dependencies. Done before unmount/cleanup so subsequent
            // isLive checks reflect the updated liveness.
            onLastDirectSubscriber(state as State<V>, data)
            // IMMEDIATE reconciliation — the one call site that does NOT consult
            // `livenessPassActive` and does not take ownership. Unsubscribing
            // from inside a subscriber callback therefore reconciles right here,
            // within someone else's owned pass, instead of deferring to it; that
            // is what keeps onUnmount semantics eager, and it cannot steal the
            // token or start a second pass. See the two-calling-modes note on
            // reconcileLivenessAfterChurn for why the three sites differ and why
            // unifying them is a behavioural change, not a cleanup.
            //
            // Negative cycle proofs are topology-versioned: across a
            // deletion-only sibling burst, each shared acyclic closure is
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
