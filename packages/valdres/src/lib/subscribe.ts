import type { Atom } from "../types/Atom"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { isAtom } from "../utils/isAtom"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import { isReactive, resolveReactive } from "../utils/resolveReactive"
import type { CacheMeta } from "../types/Atom"
import { createScalarCommit } from "./commitEngine"
import { equal } from "./equal"
import { hasAtomCommitObservers } from "./hasAtomCommitObservers"
import { initAtom } from "./initAtom"
import { initFreshActiveSelector } from "./initSelector"
import { getState } from "./getState"
import { propagateAtomUpdate } from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"
import { setMaxAgeCleanup } from "./maxAgeCleanups"
import { mountTransitiveDeps, onFirstDirectSubscriber } from "./mountAtom"
import {
    createStoreDisposedError,
    DISPOSED_STORE_PENDING,
} from "./storeLifecycle"
import { addSubscriptionEqualCheck, unsubscribe } from "./unsubscribe"
import { validateResolvedValue } from "./validateResolvedValue"

const commitRevalidationWriteOperation = (
    state: Atom<any>,
    value: any,
    data: StoreData,
    _unused1: undefined,
    _unused2: undefined,
    settle: boolean,
) => {
    setValueInData(state, value, data)
    if (settle)
        propagateAtomUpdate([state], data, false, undefined, "revalidate")
}

const runRevalidationWrite = createScalarCommit(
    commitRevalidationWriteOperation,
)

const initSubscribers = <V>(state: State<V>, data: StoreData) => {
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
        const metaAtom = (state.__cacheMeta ??= {
            equal,
            defaultValue: null,
            __valdresInternal: true,
        })
        for (const s of globalState!.stores) {
            if (s !== data && s.values.has(metaAtom)) {
                setValueInData(metaAtom, s.values.get(metaAtom), data)
                propagateAtomUpdate(
                    [metaAtom],
                    data,
                    false,
                    undefined,
                    "revalidate",
                )
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

    const metaAtom = (state.__cacheMeta ??= {
        equal,
        defaultValue: null,
        __valdresInternal: true,
    })
    const commitRevalidationWrite = (
        target: Atom<any>,
        value: any,
        store: StoreData,
    ) => {
        runRevalidationWrite(
            !cancelled,
            target,
            value,
            store,
            undefined,
            undefined,
            hasAtomCommitObservers(target, store),
        )
    }
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
                commitRevalidationWrite(metaAtom, meta, store)
            }
        } else {
            commitRevalidationWrite(metaAtom, meta, data)
        }
    }

    const isPastStaleIfErrorWindow = () => {
        const elapsed = Date.now() - lastSuccessTime
        return elapsed >= getMaxAge() + getStaleIfError()
    }

    const validateRevalidatedValue = (value: any): boolean => {
        // Schema-less atoms are the dominant maxAge path. Keep them off the
        // validation helper entirely; it would only rediscover this condition.
        if (!state.schema) return true

        // A global value is shared by every attached store. If validation is a
        // per-atom override, one check is sufficient. Otherwise, validate when
        // any attached store has opted in so the stores cannot diverge around
        // one invalid refresh.
        if (state.schemaValidation === false) return true
        if (state.schemaValidation === true || !globalState) {
            return validateResolvedValue(state, value, data)
        }
        for (const store of globalState.stores) {
            if (store.schemaValidation) {
                return validateResolvedValue(state, value, store)
            }
        }
        return true
    }

    const writeRevalidatedValue = (
        store: StoreData,
        val: any,
        valueIsPromise: boolean,
        refreshedAt?: number,
    ) => {
        const currentValue = store.values.get(state)
        // Avoid a second WeakMap lookup for the common defined-value case;
        // `has` is only needed to distinguish a stored undefined from absence.
        const hasCurrentValue =
            currentValue !== undefined || store.values.has(state)
        const areEqual =
            hasCurrentValue &&
            (valueIsPromise || isPromiseLike(currentValue)
                ? currentValue === val
                : state.equal(currentValue, val))
        if (areEqual) {
            // An equal successful refresh is still fresh. Preserve the
            // canonical stored reference and subscriber silence, but move
            // the lazy-revalidation timestamp forward so an unsubscribe
            // followed by a read does not immediately fetch again.
            if (refreshedAt !== undefined) {
                store.lastValueWriteAt.set(state, refreshedAt)
            }
            return
        }
        commitRevalidationWrite(state, val, store)
    }

    const setAndPropagate = (val: any, refreshedAt?: number) => {
        const valueIsPromise = isPromiseLike(val)
        if (globalState) {
            for (const store of globalState.stores) {
                writeRevalidatedValue(store, val, valueIsPromise, refreshedAt)
            }
        } else {
            writeRevalidatedValue(data, val, valueIsPromise, refreshedAt)
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
                if (!validateRevalidatedValue(resolved)) {
                    if (lastGoodValue !== NO_VALUE) {
                        setAndPropagate(lastGoodValue)
                    }
                    updateMeta()
                    return
                }
                lastSuccessTime = Date.now()
                lastGoodValue = resolved
                setAndPropagate(resolved, lastSuccessTime)
                updateMeta()
            }

            const handleReject = () => {
                if (cancelled) return
                revalidating = false
                if (!isPastStaleIfErrorWindow() && lastGoodValue !== NO_VALUE) {
                    setAndPropagate(lastGoodValue)
                } else {
                    setAndPropagate(value)
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
                        setAndPropagate(value)
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
                setAndPropagate(value)
                value.then(handleResolve, handleReject)
            }
        } else {
            if (!validateRevalidatedValue(value)) return
            lastSuccessTime = Date.now()
            lastGoodValue = value
            setAndPropagate(value, lastSuccessTime)
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
            subscribe(
                state.staleWhileRevalidate as any,
                () => updateMeta(),
                false,
                data,
            ),
        )
    }
    if (state.staleIfError && isReactive(state.staleIfError)) {
        configUnsubs.push(
            subscribe(
                state.staleIfError as any,
                () => updateMeta(),
                false,
                data,
            ),
        )
    }

    const cleanup = () => {
        cancelled = true
        clearInterval(currentInterval)
        for (const t of pendingTimeouts) clearTimeout(t)
        pendingTimeouts.clear()
        let firstError: unknown
        let hasError = false
        for (const unsub of configUnsubs) {
            try {
                unsub()
            } catch (error) {
                if (!hasError) {
                    firstError = error
                    hasError = true
                }
            }
        }
        if (hasError) throw firstError
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
                return
            }

            // The store that created the shared interval also owns its
            // reactive config subscriptions. If that owner leaves while other
            // direct subscribers remain, rebuild the single interval through
            // those live stores so no lifecycle resource stays attached to the
            // terminal owner. The first survivor creates the interval and the
            // rest join its ref-counted entry.
            const survivors: StoreData[] = []
            for (const store of globalState.stores) {
                if (
                    store !== data &&
                    (store.subscriptions.get(state)?.size ?? 0) > 0
                ) {
                    survivors.push(store)
                }
            }

            let firstError: unknown
            let hasError = false
            try {
                entry.cleanup()
            } catch (error) {
                firstError = error
                hasError = true
            }
            entry.refCount = 0
            if (globalState.maxAgeInterval === entry) {
                globalState.maxAgeInterval = undefined
            }
            for (const survivor of survivors) {
                try {
                    installMaxAgeTimer(state, survivor)
                } catch (error) {
                    if (!hasError) {
                        firstError = error
                        hasError = true
                    }
                }
            }
            if (hasError) throw firstError
        })
    } else {
        setMaxAgeCleanup(data, state, cleanup)
    }
}

export const subscribe = <V>(
    state: State<V>,
    callback: (...args: any[]) => void,
    requireDeepEqualCheckBeforeCallback: boolean,
    data: StoreData,
) => {
    if (data.pendingOrphanCleanup === DISPOSED_STORE_PENDING) {
        throw createStoreDisposedError(data)
    }
    // Classify once. Besides rejecting selector-family factory objects at the
    // runtime boundary, this avoids repeating Object.hasOwn checks throughout
    // the subscription setup hot path.
    const atomState = isAtom(state)
    const atomFamilyState = !atomState && isAtomFamily(state)
    const selectorState = !atomState && !atomFamilyState && isSelector(state)
    if (!atomState && !atomFamilyState && !selectorState) {
        throw new Error("Invalid object passed to sub")
    }
    let parentUnsubscribe: undefined | (() => void)
    let dropDelegate: undefined | (() => void)
    let reDelegate: undefined | (() => void)
    if (data.parent && (atomState || atomFamilyState)) {
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
        if (atomFamilyState || !data.values.has(state)) {
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
        callback = atomFamilyState
            ? (...args) => {
                  dropDelegate!()
                  originalCallback(...args)
              }
            : () => {
                  dropDelegate!()
                  originalCallback()
              }
    } else if (!data.values.has(state) && atomState) {
        const initializedAtomsSet = new Set<Atom>()
        initAtom(state, data, initializedAtomsSet)
        if (initializedAtomsSet.size) {
            initializedAtomsSet.add(state)
            propagateAtomUpdate([...initializedAtomsSet], data, true)
        } else if (isFamilyAtom(state)) {
            propagateAtomUpdate([state], data, true)
        }
    }
    // A selector may have a revision-validated cold cache. Read through
    // getState even on a cache hit so a stale dynamic dependency set is rebuilt
    // before the first subscriber promotes it into the live reverse graph.
    if (selectorState) {
        const selectorHasValue = data.values.has(state)
        // With no value or dependency set there is nothing cold to validate.
        // Check this dominant fresh-subscription shape before touching the
        // active-marker WeakSet.
        if (!selectorHasValue && !data.stateDependencies.has(state)) {
            initFreshActiveSelector(state, data, new Set(), new WeakSet())
        } else if (
            !selectorHasValue ||
            (data.coldSelectorCachesEnabled &&
                !data.selectorGraphActive.has(state))
        ) {
            // Existing cold caches must validate before promotion; an active
            // selector whose value was dropped must re-evaluate in graph mode.
            getState(state, data, new Set(), new WeakSet())
        }
    }

    const subscribers =
        data.subscriptions.get(state) || initSubscribers(state, data)

    let subscription
    if (atomFamilyState) {
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
    // This public equality table also serves as disposal's iterable active-state
    // index. Equality counts live on the subscriber Set, so the map remains one
    // O(1) write per state transition rather than a second bookkeeping structure.
    if (subscribers.size === 1 && !requireDeepEqualCheckBeforeCallback) {
        data.subscriptionsRequireEqualCheck.set(state, undefined)
    }
    if (requireDeepEqualCheckBeforeCallback) {
        addSubscriptionEqualCheck(state, subscribers, data)
    }
    const unsubscribeSubscription = () => {
        if (!parentUnsubscribe) {
            unsubscribe(state, subscription, data)
            return
        }
        // A delegated parent cleanup is user code and may throw. The local
        // subscription still has to unwind in that case.
        try {
            parentUnsubscribe()
        } finally {
            unsubscribe(state, subscription, data)
        }
    }
    if (subscribers.size === 1) {
        try {
            // Skip scope-local timer installation: reaching the non-delegating
            // branch in a scope means the atom was shadowed via `set()`, which
            // we treat as a deliberate pin. Running an extra timer here would
            // overwrite the shadow on the next tick and double the work for
            // non-global maxAge atoms (which lack the refCount sharing that
            // installMaxAgeTimer uses for global atoms).
            if (atomState && state.maxAge !== undefined && !data.parent) {
                installMaxAgeTimer(state, data)
            }
            // First direct subscriber: bump liveness through the dep graph.
            // Selectors track this via stateDependencies; families have none.
            if (!atomFamilyState) {
                // First direct subscriber is an ADDITIVE liveness change — the
                // incremental walk is correct here, including through cycles (each
                // live dependent is counted once; the prev===0 guard visits each
                // node the single time it flips live). Deps built lazily via get()
                // after this subscribe are reconciled by getDefault's own pass.
                onFirstDirectSubscriber(state as State, data)
                mountTransitiveDeps(state, data)
            }
        } catch (error) {
            // Preserve the mount error if rollback encounters a secondary
            // cleanup error.
            try {
                unsubscribeSubscription()
            } catch {}
            throw error
        }
    }

    return unsubscribeSubscription
}
