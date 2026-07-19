import type { StoreData } from "../types/StoreData"

// StoreData exposes the legacy boolean map publicly. Keep it accurate without
// scanning surviving subscriptions; weak keys avoid extending either lifetime.
const countsByStore = new WeakMap<StoreData, WeakMap<WeakKey, number>>()

export const addSubscriptionEqualCheck = (
    state: WeakKey,
    data: StoreData,
) => {
    let counts = countsByStore.get(data)
    if (!counts) {
        counts = new WeakMap()
        countsByStore.set(data, counts)
    }
    const count = counts.get(state) ?? 0
    counts.set(state, count + 1)
    if (count === 0) {
        data.subscriptionsRequireEqualCheck.set(state, true)
    }
}

export const removeSubscriptionEqualCheck = (
    state: WeakKey,
    data: StoreData,
) => {
    const counts = countsByStore.get(data)
    if (!counts) return
    const count = counts.get(state)
    if (count === undefined) return
    if (count === 1) {
        counts.delete(state)
        data.subscriptionsRequireEqualCheck.delete(state)
        return
    }
    counts.set(state, count - 1)
}
