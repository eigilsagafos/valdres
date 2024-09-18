import equal from "fast-deep-equal"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { initSelector } from "./initSelector"

export const updateSelectorSubscribers = (
    selector: Selector,
    data: StoreData,
    oldValue,
) => {
    const subscribtions = data.subscriptions.get(selector)
    const familySubscriptions =
        selector.family && data.subscriptions.get(selector.family)

    if (!subscribtions?.size && !familySubscriptions?.size) return

    let newValue
    try {
        newValue = initSelector(selector, data)
    } catch (e) {
        // We have to do this as jotai does not check if the value has changed
    }
    if (equal(newValue, oldValue)) return

    if (subscribtions?.size) {
        for (const subscribtion of subscribtions) {
            subscribtion.callback()
        }
    }
    if (familySubscriptions?.size) {
        for (const subscribtion of familySubscriptions) {
            subscribtion.callback(state.familyKey)
        }
    }
}
