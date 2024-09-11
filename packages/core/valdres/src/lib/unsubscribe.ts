import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"

export const unsubscribe = <V>(
    state: State<V>,
    subscription,
    store: StoreData,
    mountRes?: any,
) => {
    const subscribers = store.subscriptions.get(state)
    if (subscribers) {
        subscribers.delete(subscription)
        if (subscribers.size === 0) {
            if (state.onUnmount) {
                state.onUnmount(mountRes)
            }
        }
    }
}
