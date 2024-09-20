import equal from "fast-deep-equal"
import { initSelector } from "./initSelector"
import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"

export const updateSelectorSubscribers = (
    selector: Selector,
    data: StoreData,
) => {
    const subscribtions = data.subscriptions.get(selector)
    const familySubscriptions =
        selector.family && data.subscriptions.get(selector.family)

    if (!subscribtions?.size && !familySubscriptions?.size) return

    if (
        (subscribtions?.size &&
            data.subscriptionsRequireEqualCheck.get(selector)) ||
        (familySubscriptions?.size &&
            data.subscriptionsRequireEqualCheck.get(selector.family))
    ) {
        /**
         * As this is just an optimization to check stop subscription callbacks if a value
         * did not change we catch any errors here to let it bubble up in the right place
         * later on. The case might sometime be that the subscription is destroyed before
         * the value is ever used, and the error might be because of state changes that
         * also leads to the subscripion no longer being relevant.
         */
        try {
            const oldValue = data.expiredValues.get(selector)
            const newValue = initSelector(selector, data)
            if (equal(newValue, oldValue)) return
        } catch (e) {}
    }

    if (subscribtions?.size) {
        for (const subscribtion of subscribtions) {
            console.log(subscribtion)
            subscribtion.callback()
        }
    }
    if (familySubscriptions?.size) {
        for (const subscribtion of familySubscriptions) {
            subscribtion.callback(state.familyKey)
        }
    }
}
