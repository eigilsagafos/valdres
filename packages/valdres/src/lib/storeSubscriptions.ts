import type { Family } from "../types/Family"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"

const ACTIVE_SUBSCRIPTION_STATES = Symbol("valdres.activeSubscriptionStates")
const SUBSCRIPTION_STATE_INDEX = Symbol("valdres.subscriptionStateIndex")

type SubscriberSet = Set<Subscription> & {
    [SUBSCRIPTION_STATE_INDEX]?: number
}

type SubscriptionTable = StoreData["subscriptions"] & {
    [ACTIVE_SUBSCRIPTION_STATES]?: (State | Family<any>)[]
}

/** Track each subscribed state once without changing the WeakMap lookup path. */
export const trackStoreSubscriptionState = (
    state: State | Family<any>,
    subscribers: Set<Subscription>,
    data: StoreData,
): void => {
    const table = data.subscriptions as SubscriptionTable
    const active = (table[ACTIVE_SUBSCRIPTION_STATES] ??= [])
    const length = active.length
    if (length === 1) {
        const firstSubscribers = table.get(active[0]) as
            | SubscriberSet
            | undefined
        if (firstSubscribers) firstSubscribers[SUBSCRIPTION_STATE_INDEX] = 0
    }
    if (length > 0) {
        const owned = subscribers as SubscriberSet
        owned[SUBSCRIPTION_STATE_INDEX] = length
    }
    active.push(state)
}

/** The caller invokes this only when the state's final subscriber is removed. */
export const untrackStoreSubscriptionState = (
    state: State | Family<any>,
    subscribers: Set<Subscription>,
    data: StoreData,
): void => {
    const table = data.subscriptions as SubscriptionTable
    const active = table[ACTIVE_SUBSCRIPTION_STATES]
    if (!active) return
    if (active.length === 1) {
        if (active[0] === state) active.pop()
        return
    }
    const owned = subscribers as SubscriberSet
    const index = owned[SUBSCRIPTION_STATE_INDEX]
    if (index === undefined || active[index] !== state) return
    const tail = active.pop()!
    if (tail !== state) {
        active[index] = tail
        const tailSubscribers = table.get(tail) as SubscriberSet | undefined
        if (tailSubscribers) tailSubscribers[SUBSCRIPTION_STATE_INDEX] = index
    }
    owned[SUBSCRIPTION_STATE_INDEX] = undefined
}

/** Transfer active state ownership to the terminal disposal pass. */
export const takeStoreSubscriptionStates = (
    data: StoreData,
): (State | Family<any>)[] | undefined => {
    const table = data.subscriptions as SubscriptionTable
    const active = table[ACTIVE_SUBSCRIPTION_STATES]
    table[ACTIVE_SUBSCRIPTION_STATES] = undefined
    return active
}
