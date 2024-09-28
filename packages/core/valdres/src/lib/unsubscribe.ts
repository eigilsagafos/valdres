import type { Family } from "../types/Family"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"

export const unsubscribe = <V>(
    state: State<V> | Family<V>,
    subscription: Subscription,
    data: StoreData,
    mount?: any,
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
        if (mount) {
            if (subscribers.size === mount.mountSubscriptions.size) {
                // @ts-ignore @ts-todo
                if (typeof mount.onUnmount === "function") {
                    // @ts-ignore @ts-todo
                    mount.onUnmount()
                }
            }
        }
    }
}
