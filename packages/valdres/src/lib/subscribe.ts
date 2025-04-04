import type { Atom } from "../types/Atom"
import type { Family } from "../types/Family"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamily } from "../utils/isFamily"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import { isSelectorFamily } from "../utils/isSelectorFamily"
import { getAtomInitValue, initAtom } from "./initAtom"
import { initSelector } from "./initSelector"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"
import { storeFromStoreData } from "./storeFromStoreData"
import { unsubscribe } from "./unsubscribe"

const initSubscribers = <V>(state: State<V> | Family<V>, data: StoreData) => {
    const set = new Set<Subscription>()
    data.subscriptions.set(state, set)
    return set
}

// class SelectorFamilySubscriptionNotSupported extends Error {
//     constructor() {
//         super("Selector family subscription not supported")
//         this.name = "SelectorFamilySubscriptionNotSupported"
//     }
// }

// const createTwoWayDependecyBinding = (parent, child, data) => {

//     throw new Error("TODO: Implement this")
// }

export const subscribe = <V>(
    state: State<V> | Family<V>,
    callback: (arg?: any) => void,
    requireDeepEqualCheckBeforeCallback: boolean,
    data: StoreData,
) => {
    let parentUnsubscribe: undefined | (() => void)
    if (
        "parent" in data &&
        ((!data.values.has(state) && isAtom(state)) || isAtomFamily(state))
    ) {
        /**
         * Getting here means that we are within a scope and that the current
         * atom is not set in the current scope. Therfore we pass the subscription
         * up the tree and modify the callback to unsubscribe to the parent store
         * in the case that it is set in this scope.
         */
        const originalCallback = callback
        parentUnsubscribe = subscribe(
            state,
            originalCallback,
            requireDeepEqualCheckBeforeCallback,
            data.parent,
        )
        callback = arg => {
            if (parentUnsubscribe) {
                /**
                 * TODO: Find way to test this. Maybe use onMount?
                 * Here we ensure that the unsubscribe happens only once.
                 * This is not yet covered in tests.
                 */
                parentUnsubscribe()
                parentUnsubscribe = undefined
            }
            originalCallback(arg)
        }
    } else if (!data.values.has(state) && isAtom(state)) {
        const initializedAtomsSet = new Set<Atom>()
        initAtom(state, data, initializedAtomsSet)
        if (initializedAtomsSet.size) {
            throw new Error("This should not be possible")
        }
    }
    // TODO: Should we init no matter what if not in data.values? Or is that the wrong approach?
    if (isSelector(state) && !data.values.has(state)) {
        initSelector(state, data, new Set(), new WeakSet())
    }

    const subscribers =
        data.subscriptions.get(state) || initSubscribers(state, data)

    let subscription
    if (isFamily(state)) {
        if (isSelectorFamily(state)) {
            throw new Error(
                "Subscribe to selectorFammily is currently not supported",
            )
            // let TEST_SYMB = Symbol("asdf")
            // const dependencies = []
            // const accumulator = depState => {
            //     if (isFamilyAtom(depState)) {
            //         if (
            //             depState.familyArgs[0] === TEST_SYMB &&
            //             depState.familyArgs.length === 1
            //         ) {
            //             dependencies.push(depState.family)
            //             // return null
            //             // return depState.familyArgs[1]
            //         } else {
            //             throw new SelectorFamilySubscriptionNotSupported()
            //         }
            //         // // if (isAtom(depState)) {
            //         // // }
            //         // isSelectorFamily(depState)
            //         // throw new Error("TODO 000")
            //     } else {
            //         throw new SelectorFamilySubscriptionNotSupported()
            //     }
            // }
            // try {
            //     state(TEST_SYMB).get(accumulator)
            // } catch (e) {
            //     if (e instanceof SelectorFamilySubscriptionNotSupported) {
            //         throw e
            //     }
            // }
            // dependencies.forEach(dependency => {
            //     if (isAtomFamily(dependency)) {
            //         // Now we have a selectorFamily that is depentent on a atomFamily
            //         createTwoWayDependecyBinding(state, dependency, data)
            //     } else {
            //         throw new SelectorFamilySubscriptionNotSupported()
            //     }
            // })
        }
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
                // @ts-ignore @ts-todo
                let value = getAtomInitValue(state, data)
                // TODO: Fix interal
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
                    setValueInData(state, value, data)
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
            // @ts-ignore
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

    return () => {
        if (parentUnsubscribe) {
            // TODO: Test this scenario
            parentUnsubscribe()
        }
        unsubscribe(state, subscription, data, mount, maxAgeCleanup)
    }
}
