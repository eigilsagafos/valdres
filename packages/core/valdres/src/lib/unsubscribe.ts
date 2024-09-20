import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"

export const unsubscribe = <V>(
    state: State<V>,
    subscription,
    data: StoreData,
    mountRes?: any,
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
            if (state.onUnmount) {
                state.onUnmount(mountRes)
            }
        }
    }
}
