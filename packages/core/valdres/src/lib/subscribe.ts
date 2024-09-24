import type { Family } from "../types/Family"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { isFamily } from "../utils/isFamily"
import { isSelector } from "../utils/isSelector"
import { initSelector } from "./initSelector"
import { setAtom } from "./setAtom"
import { unsubscribe } from "./unsubscribe"

const initSubscribers = <V>(state: State<V> | Family<V>, data: StoreData) => {
    const set = new Set()
    data.subscriptions.set(state, set)
    return set
}

export const subscribe = <V>(
    state: State<V> | Family<V>,
    callback: any,
    requireDeepEqualCheckBeforeCallback: boolean,
    data: StoreData,
) => {
    const subscribers =
        data.subscriptions.get(state) || initSubscribers(state, data)

    if (isSelector(state) && !data.values.has(state)) {
        initSelector(state, data)
    }
    let subscription
    if (isFamily(state)) {
        subscription = {
            callback,
            state,
            requireDeepEqualCheckBeforeCallback,
        }
    } else {
        subscription = {
            callback,
            requireDeepEqualCheckBeforeCallback,
        }
    }
    let mountRes: any
    // @ts-ignore
    if (subscribers.size === 0 && state.onMount) {
        // @ts-ignore
        mountRes = state.onMount(value => {
            setAtom(state, value, data)
            // throw new Error(`Fix tghis`)
        })
    }
    subscribers.add(subscription)

    if (
        requireDeepEqualCheckBeforeCallback &&
        data.subscriptionsRequireEqualCheck.get(state) !== true
    ) {
        data.subscriptionsRequireEqualCheck.set(state, true)
    }

    return () => unsubscribe(state, subscription, data, mountRes)
}
