import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { isFamilyState } from "../utils/isFamilyState"

export const updateStateSubscribers = <V>(state: State, data: StoreData) => {
    const subscribtions = data.subscriptions.get(state)
    if (subscribtions?.size) {
        for (const subscribtion of subscribtions) {
            subscribtion.callback()
        }
    }
    if (isFamilyState(state)) {
        const familySubscriptions = data.subscriptions.get(state.family)
        if (familySubscriptions?.size) {
            for (const subscribtion of familySubscriptions) {
                subscribtion.callback(state.familyKey)
            }
        }
    }
}
