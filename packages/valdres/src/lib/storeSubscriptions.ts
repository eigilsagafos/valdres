import type { Family } from "../types/Family"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"

const ACTIVE_SUBSCRIPTIONS = Symbol("valdres.activeSubscriptions")
const SUBSCRIPTION_INDEX = Symbol("valdres.subscriptionIndex")
const SUBSCRIPTION_STATE = Symbol("valdres.subscriptionState")

type OwnedSubscription = Subscription & {
    [SUBSCRIPTION_INDEX]: number
    [SUBSCRIPTION_STATE]: State | Family<any>
}

type SubscriptionTable = WeakMap<WeakKey, Set<Subscription>> & {
    [ACTIVE_SUBSCRIPTIONS]?: OwnedSubscription[]
}

/** Track active ownership without changing StoreData or its WeakMap lookup path. */
export const trackStoreSubscription = (
    state: State | Family<any>,
    subscription: Subscription,
    data: StoreData,
): void => {
    const table = data.subscriptions as SubscriptionTable
    const active = (table[ACTIVE_SUBSCRIPTIONS] ??= [])
    const owned = subscription as OwnedSubscription
    owned[SUBSCRIPTION_INDEX] = active.length
    owned[SUBSCRIPTION_STATE] = state
    active.push(owned)
}

/** O(1) swap-pop removal for the ordinary unsubscribe path. */
export const untrackStoreSubscription = (
    subscription: Subscription,
    data: StoreData,
): void => {
    const table = data.subscriptions as SubscriptionTable
    const active = table[ACTIVE_SUBSCRIPTIONS]
    if (!active) return
    const owned = subscription as OwnedSubscription
    const index = owned[SUBSCRIPTION_INDEX]
    if (index < 0 || active[index] !== owned) return
    const tail = active.pop()!
    if (tail !== owned) {
        active[index] = tail
        tail[SUBSCRIPTION_INDEX] = index
    }
    owned[SUBSCRIPTION_INDEX] = -1
    if (active.length === 0) table[ACTIVE_SUBSCRIPTIONS] = undefined
}

/** Transfer active ownership to the terminal disposal pass. */
export const takeStoreSubscriptions = (
    data: StoreData,
): OwnedSubscription[] | undefined => {
    const table = data.subscriptions as SubscriptionTable
    const active = table[ACTIVE_SUBSCRIPTIONS]
    table[ACTIVE_SUBSCRIPTIONS] = undefined
    return active
}

export const stateForStoreSubscription = (
    subscription: OwnedSubscription,
): State | Family<any> => subscription[SUBSCRIPTION_STATE]
