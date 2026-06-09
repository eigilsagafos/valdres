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
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"
import { setMaxAgeCleanup } from "./maxAgeCleanups"
import { mountTransitiveDeps, onFirstDirectSubscriber } from "./mountAtom"
import { unsubscribe } from "./unsubscribe"

const initSubscribers = <V>(state: State<V> | Family<V>, data: StoreData) => {
    const set = new Set<Subscription>()
    data.subscriptions.set(state, set)
    return set
}

export const installMaxAgeTimer = (state: Atom<any>, data: StoreData) => {
    if (state.maxAge === undefined) return
    const globalState = isGlobalAtom(state) ? state : undefined
    const existing = globalState?.maxAgeInterval

    if (existing) {
        // Another store already owns the interval — just bump refCount
        existing.refCount++
        // Seed the cache meta in this store from an existing store
        const metaAtom = (state.__cacheMeta ??= { equal, defaultValue: null, __valdresInternal: true })
        for (const s of globalState!.stores) {
            if (s !== data && s.values.has(metaAtom)) {
                setValueInData(metaAtom, s.values.get(metaAtom), data)
                propagateAtomUpdate([metaAtom], data, false, undefined, "revalidate")
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

    const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>()
    let revalidating = false
    let cancelled = false
    let lastSuccessTime = Date.now()
    const NO_VALUE = Symbol()
    let lastGoodValue: any = NO_VALUE
    let currentInterval: ReturnType<typeof setInterval>

    const getMaxAge = (): number => resolveReactive(state.maxAge!, data)
    const getSWR = (): number =>
        state.staleWhileRevalidate !== undefined
            ? resolveReactive(state.staleWhileRevalidate, data)
            : Infinity
    const getStaleIfError = (): number =>
        state.staleIfError !== undefined
            ? resolveReactive(state.staleIfError, data)
            : Infinity

    const metaAtom = (state.__cacheMeta ??= { equal, defaultValue: null, __valdresInternal: true })
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
                propagateAtomUpdate([metaAtom], store, false, undefined, "revalidate")
            }
        } else {
            setValueInData(metaAtom, meta, data)
            propagateAtomUpdate([metaAtom], data, false, undefined, "revalidate")
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
                propagateAtomUpdate([atom], store, false, undefined, "revalidate")
            }
        } else {
            setValueInData(atom, val, data)
            propagateAtomUpdate([atom], data, false, undefined, "revalidate")
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
                let timeoutRef: ReturnType<typeof setTimeout> | undefined
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
    let dropDelegate: undefined | (() => void)
    let reDelegate: undefined | (() => void)
    if (data.parent && (isAtom(state) || isAtomFamily(state))) {
        /**
         * Getting here means that we are within a scope subscribing to an atom
         * (or a family, which always reads through). While the scope does not
         * shadow the atom we delegate the subscription up the tree, modifying
         * the callback to drop the delegate if the scope later shadows it. We
         * keep the delegation machinery even when the atom is currently shadowed
         * so `unset` can re-establish the delegate when the shadow is dropped.
         */
        const originalCallback = callback
        const delegateToParent = () =>
            subscribe(
                state,
                originalCallback,
                requireDeepEqualCheckBeforeCallback,
                data.parent!,
            )
        // A family always reads through (no own value); an atom delegates only
        // while this scope does not shadow it.
        if (isAtomFamily(state) || !data.values.has(state)) {
            parentUnsubscribe = delegateToParent()
        }
        // Idempotent: once the scope re-roots the subscription, the parent-side
        // delegate must drop so we don't double-notify on later writes. This
        // fires either lazily (first scope-local propagation, below) or eagerly
        // (when the scope shadows the state — see setValueInData), whichever
        // comes first.
        dropDelegate = () => {
            if (parentUnsubscribe) {
                parentUnsubscribe()
                parentUnsubscribe = undefined
            }
        }
        // Inverse of dropDelegate: re-establish the parent delegate. Idempotent.
        // Mutates the same `parentUnsubscribe` cell that the returned unsubscribe
        // closure reads, so a re-delegated subscription is still torn down
        // correctly on unsubscribe.
        reDelegate = () => {
            if (!parentUnsubscribe) {
                parentUnsubscribe = delegateToParent()
            }
        }
        callback = arg => {
            dropDelegate!()
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
            reRoot: dropDelegate,
            reDelegate,
        }
    } else {
        subscription = {
            callback,
            requireDeepEqualCheckBeforeCallback,
            reRoot: dropDelegate,
            reDelegate,
        }
    }
    subscribers.add(subscription)
    if (subscribers.size === 1) {
        // Skip scope-local timer installation: reaching the non-delegating
        // branch in a scope means the atom was shadowed via `set()`, which
        // we treat as a deliberate pin. Running an extra timer here would
        // overwrite the shadow on the next tick and double the work for
        // non-global maxAge atoms (which lack the refCount sharing that
        // installMaxAgeTimer uses for global atoms).
        if (isAtom(state) && state.maxAge !== undefined && !data.parent) {
            installMaxAgeTimer(state, data)
        }
        // First direct subscriber: bump liveness through the dep graph.
        // Selectors track this via stateDependencies; families have none.
        if (!isFamily(state)) {
            onFirstDirectSubscriber(state as State, data)
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
            parentUnsubscribe()
        }
        unsubscribe(state, subscription, data)
    }
}
