import type { Family } from "../types/Family"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { unmountOrphanedDeps } from "./mountAtom"

export const unsubscribe = <V>(
    state: State<V> | Family<V>,
    subscription: Subscription,
    data: StoreData,
    maxAgeCleanup?: any,
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
            if (maxAgeCleanup) maxAgeCleanup()
            data.subscriptions.delete(state)
            // Unmount this state and any transitive dependencies that are
            // no longer reachable from any subscriber.
            unmountOrphanedDeps(state as State<V>, data)
        }
    }
}
