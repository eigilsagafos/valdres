import type { Atom } from "../types/Atom"
import type { Family } from "../types/Family"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamily } from "../utils/isFamily"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import { isSelectorFamily } from "../utils/isSelectorFamily"
import { isReactive, resolveReactive } from "../utils/resolveReactive"
import type { CacheMeta } from "../types/Atom"
import { equal } from "./equal"
import { initAtom } from "./initAtom"
import { initSelector } from "./initSelector"
import { propagateUpdatedAtoms } from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"
import { setMaxAgeCleanup } from "./maxAgeCleanups"
import { mountTransitiveDeps } from "./mountAtom"
import { unsubscribe } from "./unsubscribe"

const initSubscribers = <V>(state: State<V> | Family<V>, data: StoreData) => {
    const set = new Set<Subscription>()
    data.subscriptions.set(state, set)
    return set
}

export const installMaxAgeTimer = (state: Atom<any>, data: StoreData) => {
    if (!state.maxAge) return
    const globalState = isGlobalAtom(state) ? state : undefined
    const existing = globalState?.maxAgeInterval

    if (existing) {
        // Another store already owns the interval — just bump refCount
        existing.refCount++
        // Seed the cache meta in this store from an existing store
        const metaAtom = (state.__cacheMeta ??= { equal, defaultValue: null })
        for (const s of globalState!.stores) {
            if (s !== data && s.values.has(metaAtom)) {
                setValueInData(metaAtom, s.values.get(metaAtom), data)
                propagateUpdatedAtoms([metaAtom], data)
                break
            }
        }
        setMaxAgeCleanup(data, state, () => {
            if (existing.refCount <= 0) return
            existing.refCount--
            if (existing.refCount === 0) {
                existing.cleanup()
                if (globalState!.maxAgeInterval === existing) {
                    globalState!.maxAgeInterval = undefined
                }
            }
        })
        return
    }

    const pendingTimeouts = new Set<Timer>()
    let revalidating = false
    let cancelled = false
    let lastSuccessTime = Date.now()
    const NO_VALUE = Symbol()
    let lastGoodValue: any = NO_VALUE
    let currentInterval: Timer

    const getMaxAge = (): number => resolveReactive(state.maxAge!, data)
    const getSWR = (): number =>
        state.staleWhileRevalidate !== undefined
            ? resolveReactive(state.staleWhileRevalidate, data)
            : Infinity
    const getStaleIfError = (): number =>
        state.staleIfError !== undefined
            ? resolveReactive(state.staleIfError, data)
            : Infinity

    const metaAtom = (state.__cacheMeta ??= { equal, defaultValue: null })
    const updateMeta = () => {
        const meta: CacheMeta = {
            isRevalidating: revalidating,
            lastSuccessAt: lastSuccessTime,
            maxAge: getMaxAge(),
            staleWhileRevalidate: getSWR(),
            staleIfError: getStaleIfError(),
        }
        if (globalState) {
            for (const store of globalState.stores) {
                setValueInData(metaAtom, meta, store)
                propagateUpdatedAtoms([metaAtom], store)
            }
        } else {
            setValueInData(metaAtom, meta, data)
            propagateUpdatedAtoms([metaAtom], data)
        }
    }

    const isPastStaleIfErrorWindow = () => {
        const elapsed = Date.now() - lastSuccessTime
        return elapsed >= getMaxAge() + getStaleIfError()
    }

    const setAndPropagate = (atom: Atom, val: any) => {
        if (globalState) {
            for (const store of globalState.stores) {
                setValueInData(atom, val, store)
                propagateUpdatedAtoms([atom], store)
            }
        } else {
            setValueInData(atom, val, data)
            propagateUpdatedAtoms([atom], data)
        }
    }

    // For global atoms, read the current value from any store in the set
    // rather than the closed-over `data` which may become stale if that
    // store is detached.
    const getValueStore = (): StoreData => {
        if (globalState) {
            for (const s of globalState.stores) return s
            // All stores detached — fall back to the original
        }
        return data
    }

    const tick = () => {
        if (revalidating) return
        if (typeof state.defaultValue !== "function") return
        const valueStore = getValueStore()
        if (valueStore.values.has(state)) {
            const currentValue = valueStore.values.get(state)
            if (!isPromiseLike(currentValue)) {
                lastGoodValue = currentValue
            }
        }
        const value = (state.defaultValue as () => any)()
        if (isPromiseLike(value)) {
            revalidating = true
            updateMeta()
            const swr = getSWR()

            const handleResolve = (resolved: any) => {
                if (cancelled) return
                revalidating = false
                lastSuccessTime = Date.now()
                lastGoodValue = resolved
                setAndPropagate(state, resolved)
                updateMeta()
            }

            const handleReject = () => {
                if (cancelled) return
                revalidating = false
                if (
                    !isPastStaleIfErrorWindow() &&
                    lastGoodValue !== NO_VALUE
                ) {
                    setAndPropagate(state, lastGoodValue)
                } else {
                    setAndPropagate(state, value)
                }
                updateMeta()
            }

            if (swr > 0) {
                // SWR: keep stale value visible during revalidation.
                // Finite swr enforces a window: if the request is still
                // in flight when it expires, flip to the pending promise
                // (loading state).
                let timeoutRef: Timer | undefined
                if (Number.isFinite(swr)) {
                    timeoutRef = setTimeout(() => {
                        pendingTimeouts.delete(timeoutRef!)
                        if (cancelled || !revalidating) return
                        setAndPropagate(state, value)
                    }, swr)
                    pendingTimeouts.add(timeoutRef)
                }
                value.then(
                    (resolved: any) => {
                        if (timeoutRef !== undefined) {
                            clearTimeout(timeoutRef)
                            pendingTimeouts.delete(timeoutRef)
                        }
                        handleResolve(resolved)
                    },
                    () => {
                        if (timeoutRef !== undefined) {
                            clearTimeout(timeoutRef)
                            pendingTimeouts.delete(timeoutRef)
                        }
                        handleReject()
                    },
                )
            } else {
                // swr === 0: opt out of stale-while-revalidate; show
                // pending promise immediately on revalidate.
                setAndPropagate(state, value)
                value.then(handleResolve, handleReject)
            }
        } else {
            lastSuccessTime = Date.now()
            lastGoodValue = value
            setAndPropagate(state, value)
            updateMeta()
        }
    }

    const startInterval = () => {
        currentInterval = setInterval(tick, getMaxAge())
    }

    startInterval()
    updateMeta()

    const configUnsubs: (() => void)[] = []
    if (isReactive(state.maxAge)) {
        configUnsubs.push(
            subscribe(
                state.maxAge as any,
                () => {
                    clearInterval(currentInterval)
                    startInterval()
                    updateMeta()
                },
                false,
                data,
            ),
        )
    }
    if (state.staleWhileRevalidate && isReactive(state.staleWhileRevalidate)) {
        configUnsubs.push(
            subscribe(state.staleWhileRevalidate as any, () => updateMeta(), false, data),
        )
    }
    if (state.staleIfError && isReactive(state.staleIfError)) {
        configUnsubs.push(
            subscribe(state.staleIfError as any, () => updateMeta(), false, data),
        )
    }

    const cleanup = () => {
        cancelled = true
        clearInterval(currentInterval)
        for (const t of pendingTimeouts) clearTimeout(t)
        pendingTimeouts.clear()
        for (const unsub of configUnsubs) unsub()
    }

    if (globalState) {
        const entry = { cleanup, refCount: 1 }
        globalState.maxAgeInterval = entry
        setMaxAgeCleanup(data, state, () => {
            if (entry.refCount <= 0) return
            entry.refCount--
            if (entry.refCount === 0) {
                entry.cleanup()
                if (globalState.maxAgeInterval === entry) {
                    globalState.maxAgeInterval = undefined
                }
            }
        })
    } else {
        setMaxAgeCleanup(data, state, cleanup)
    }
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
    if (subscribers.size === 1) {
        if (isAtom(state) && state.maxAge) {
            installMaxAgeTimer(state, data)
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
        unsubscribe(state, subscription, data)
    }
}
