import type { State } from "../types/State"
import type { Store } from "../Store"
import type { StoreData } from "../types/StoreData"

const initSubscribers = (state: State<any>, store: StoreData) => {
    const set = new Set()
    store.subscriptions.set(state, set)
    return set
}

export const subscribe = <V>(
    state: State<V>,
    subscription: any,
    store: StoreData,
) => {
    const subscribers =
        store.subscriptions.get(state) || initSubscribers(state, store)
    subscribers.add(subscription)
}
