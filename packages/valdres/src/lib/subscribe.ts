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
import { initAtom } from "./initAtom"
import { initSelector } from "./initSelector"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"
import { mountTransitiveDeps } from "./mountAtom"
import { storeFromStoreData } from "./storeFromStoreData"
import { unsubscribe } from "./unsubscribe"

const initSubscribers = <V>(state: State<V> | Family<V>, data: StoreData) => {
    const set = new Set<Subscription>()
    data.subscriptions.set(state, set)
    return set
}

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
    let maxAgeCleanup: any
    if (subscribers.size === 1) {
        if (isAtom(state) && state.maxAge) {
            const pendingTimeouts = new Set<Timer>()
            let revalidating = false
            let lastSuccessTime = Date.now()
            let lastGoodValue: any = undefined
            const isPastStaleIfErrorWindow = () => {
                if (!state.staleIfError) return true
                const elapsed = Date.now() - lastSuccessTime
                return elapsed >= state.maxAge! + state.staleIfError
            }
            const interval = setInterval(() => {
                if (revalidating) return
                if (typeof state.defaultValue !== "function") return
                const currentValue = data.values.get(state)
                if (currentValue !== undefined && !isPromiseLike(currentValue)) {
                    lastGoodValue = currentValue
                }
                const value = state.defaultValue()
                if (isPromiseLike(value)) {
                    revalidating = true
                    if (state.staleWhileRevalidate) {
                        // SWR: keep stale value visible during revalidation
                        const t = setTimeout(() => {
                            pendingTimeouts.delete(t)
                        }, state.staleWhileRevalidate)
                        pendingTimeouts.add(t)
                        value.then(
                            (resolved: any) => {
                                clearTimeout(t)
                                pendingTimeouts.delete(t)
                                revalidating = false
                                lastSuccessTime = Date.now()
                                lastGoodValue = resolved
                                setValueInData(state, resolved, data)
                                propagateUpdatedAtoms([state], data)
                            },
                            () => {
                                clearTimeout(t)
                                pendingTimeouts.delete(t)
                                revalidating = false
                                if (
                                    state.staleIfError &&
                                    isPastStaleIfErrorWindow()
                                ) {
                                    // Past staleIfError window: replace stale
                                    // value with rejected promise so consumers
                                    // see the error
                                    setValueInData(state, value, data)
                                    propagateUpdatedAtoms([state], data)
                                }
                                // No staleIfError or within window: keep stale
                            },
                        )
                    } else {
                        // No SWR: show loading state during revalidation
                        setValueInData(state, value, data)
                        propagateUpdatedAtoms([state], data)
                        value.then(
                            (resolved: any) => {
                                revalidating = false
                                lastSuccessTime = Date.now()
                                lastGoodValue = resolved
                                setValueInData(state, resolved, data)
                                propagateUpdatedAtoms([state], data)
                            },
                            () => {
                                revalidating = false
                                if (
                                    !isPastStaleIfErrorWindow() &&
                                    lastGoodValue !== undefined
                                ) {
                                    // Within staleIfError window: restore last good value
                                    setValueInData(state, lastGoodValue, data)
                                    propagateUpdatedAtoms([state], data)
                                }
                                // Past window (or no staleIfError): leave
                                // rejected promise in store; interval retries
                            },
                        )
                    }
                } else {
                    lastSuccessTime = Date.now()
                    lastGoodValue = value
                    setValueInData(state, value, data)
                    propagateUpdatedAtoms([state], data)
                }
            }, state.maxAge)
            maxAgeCleanup = () => {
                clearInterval(interval)
                for (const t of pendingTimeouts) clearTimeout(t)
                pendingTimeouts.clear()
            }
        }
        // Mount this state and all its transitive dependencies
        if (!isFamily(state)) {
            mountTransitiveDeps(state, data)
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
        unsubscribe(state, subscription, data, maxAgeCleanup)
    }
}
