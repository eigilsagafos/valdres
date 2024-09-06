import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"

export const unsubscribe = <V>(
    state: State<V>,
    subscription,
    store: StoreData,
) => {
    const subscribers = store.subscriptions.get(state)
    if (subscribers) subscribers.delete(subscription)
}
