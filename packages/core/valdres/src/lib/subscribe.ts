import type { Family } from "../types/Family"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { isAtom } from "../utils/isAtom"
import { isFamily } from "../utils/isFamily"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import { getAtomInitValue } from "./initAtom"
import { initSelector } from "./initSelector"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { storeFromStoreData } from "./storeFromStoreData"
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
    subscribers.add(subscription)
    let mount: any
    let maxAgeCleanup: any
    if (subscribers.size === 1) {
        if (isAtom(state) && state.maxAge) {
            let timeout: Timer
            const interval = setInterval(() => {
                let value = getAtomInitValue(state, data)
                if (isPromiseLike(value)) {
                    if (state.staleWhileRevalidate) {
                        const oldValue = data.values.get(state)
                        timeout = setTimeout(() => {
                            const nowValue = data.values.get(state)
                            console.log("todo", oldValue)
                        }, state.staleWhileRevalidate)
                        value.then(res => clearTimeout(timeout))
                    }
                } else {
                    data.values.set(state, value)
                    propagateUpdatedAtoms([state], data)
                }
            }, state.maxAge)
            maxAgeCleanup = () => {
                clearInterval(interval)
                if (timeout) clearTimeout(timeout)
            }
        }
        // @ts-ignore
        if (state.onMount) {
            // @ts-ignore
            const store = storeFromStoreData(data)
            const mountSubscriptions = new Set()
            const originalSub = store.sub
            store.sub = (state, callback) => {
                mountSubscriptions.add(callback)
                return originalSub(state, callback)
            }
            mount = {
                // @ts-ignore
                onUnmount: state.onMount(store, state),
                mountSubscriptions,
            }
        }
    }

    if (
        requireDeepEqualCheckBeforeCallback &&
        data.subscriptionsRequireEqualCheck.get(state) !== true
    ) {
        data.subscriptionsRequireEqualCheck.set(state, true)
    }

    return () => unsubscribe(state, subscription, data, mount, maxAgeCleanup)
}
