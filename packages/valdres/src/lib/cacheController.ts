import type { Atom, CacheMeta } from "../types/Atom"
import type { CommitForestEntry } from "../types/CommitForestSettleFn"
import type { InternalGlobalAtom } from "../types/InternalGlobalAtom"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isReactive, resolveReactive } from "../utils/resolveReactive"
import { clearSupersededAsyncAtomCoordinator } from "./asyncAtomCoordinatorRegistry"
import { cacheState } from "./cacheState"
import {
    recordCacheMetaAllocation,
    recordGlobalStoreListCopy,
} from "./architectureInstrumentation"
import { runCommitPlan } from "./commitEngine"
import {
    createCommitErrors,
    recordCommitError,
    throwCommitError,
    type CommitErrors,
} from "./commitErrors"
import { SETTLE_DEFAULT } from "./commitIntents"
import { forestEntry, NO_ON_SETS, NO_SETTLEMENT } from "./commitPlans"
import { equal } from "./equal"
import { hasAtomCommitObservers } from "./hasAtomCommitObservers"
import { IS_PROD } from "./IS_PROD"
import { settleCommit, settleCommitForest } from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"
import {
    isStoreDisposed,
    trackStoreCleanup,
    untrackStoreCleanup,
} from "./storeLifecycle"
import { validateResolvedValue } from "./validateResolvedValue"

type SubscribeReactive = <V>(
    state: State<V>,
    callback: (...args: any[]) => void,
    requireDeepEqualCheckBeforeCallback: boolean,
    data: StoreData,
) => () => void

const publishLocalWrite = (
    state: Atom<any>,
    value: any,
    data: StoreData,
): void => {
    clearSupersededAsyncAtomCoordinator(state, data)
    setValueInData(state, value, data)
    if (hasAtomCommitObservers(state, data))
        settleCommit([state], data, undefined, "revalidate", SETTLE_DEFAULT)
}

const publishAdmittedLocalWrite = (
    state: Atom<any>,
    value: any,
    data: StoreData,
    admit: () => boolean,
): boolean => {
    if (!admit()) return false
    publishLocalWrite(state, value, data)
    return true
}

const installStoreRelease = (
    state: Atom<any>,
    data: StoreData,
    cleanup: () => void,
): void => {
    let active = true
    const release = () => {
        if (!active) return
        active = false
        untrackStoreCleanup(data, release)
        cacheState.clearRelease(state, data, release)
        cleanup()
    }
    const previous = cacheState.installRelease(state, data, release)
    if (previous) untrackStoreCleanup(data, previous)
    trackStoreCleanup(data, release)
}

const release = (state: State, data: StoreData): void => {
    cacheState.peek(state, data)?.release?.()
}

const expireIfStale = (state: State, data: StoreData): boolean => {
    const atom = state as Atom<any>
    const maxAge = atom.maxAge
    if (maxAge === undefined || data.parent) return false
    const global = isGlobalAtom(atom)
    if (global) {
        if (atom.cacheController !== undefined) return false
    }
    const entry = cacheState.peek(state, data)
    if (!global && entry?.release !== undefined) {
        return false
    }
    const lastWriteAt = entry?.lastWriteAt
    if (lastWriteAt === undefined) return false
    const ttl =
        typeof maxAge === "number" ? maxAge : resolveReactive(maxAge, data)
    if (Date.now() - lastWriteAt <= ttl) return false

    // Deliberately unpublished: a cold read invalidates the stale cache and
    // immediately falls through to ordinary initialization. Opening a commit
    // here would make store.get() observable through onCommitEnd.
    clearSupersededAsyncAtomCoordinator(atom, data)
    data.values.delete(state)
    cacheState.clearWrite(atom, data, entry)
    return true
}

const retain = (
    state: Atom<any>,
    data: StoreData,
    subscribeReactive: SubscribeReactive,
): void => {
    if (state.maxAge === undefined) return
    const globalState = isGlobalAtom(state) ? state : undefined
    const existing = globalState?.cacheController

    if (existing) {
        existing.refCount++
        installStoreRelease(state, data, () => {
            if (existing.refCount <= 0) return
            existing.refCount--
            if (existing.refCount === 0) {
                try {
                    existing.cleanup()
                } finally {
                    if (globalState!.cacheController === existing) {
                        globalState!.cacheController = undefined
                    }
                }
            }
        })
        const metaAtom = (state.__cacheMeta ??= {
            equal,
            defaultValue: null,
            __valdresInternal: true,
        })
        for (const store of globalState!.stores) {
            if (store !== data && store.values.has(metaAtom)) {
                publishAdmittedLocalWrite(
                    metaAtom,
                    store.values.get(metaAtom),
                    data,
                    existing.active,
                )
                break
            }
        }
        return
    }

    const pendingTimeouts = new Set<ReturnType<typeof setTimeout>>()
    let revalidating = false
    let cancelled = false
    let generation = 0
    let lastSuccessTime = Date.now()
    const NO_VALUE = Symbol()
    let lastGoodValue: any = NO_VALUE
    let currentInterval: ReturnType<typeof setInterval> | undefined
    const configUnsubs: (() => void)[] = []
    const current = (requestGeneration: number) =>
        !cancelled && generation === requestGeneration && !isStoreDisposed(data)
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

    const publishGlobalWrite = (
        target: Atom<any>,
        value: any,
        requestGeneration: number,
        errors: CommitErrors,
        copyStores: boolean,
        refreshedAt?: number,
    ): void => {
        if (copyStores && !IS_PROD && data.architectureInstrumentation)
            recordGlobalStoreListCopy(data)
        const stores = copyStores
            ? [...globalState!.stores]
            : globalState!.stores
        const entries: CommitForestEntry[] = []
        for (const store of stores) {
            if (!current(requestGeneration)) break
            try {
                const currentValue = store.values.get(target)
                const hasCurrentValue =
                    currentValue !== undefined || store.values.has(target)
                const valueIsPromise = isPromiseLike(value)
                const areEqual =
                    hasCurrentValue &&
                    (valueIsPromise || isPromiseLike(currentValue)
                        ? currentValue === value
                        : target.equal(currentValue, value))
                if (areEqual) {
                    if (refreshedAt !== undefined)
                        cacheState.recordWrite(target, store, refreshedAt)
                    continue
                }
                if (hasCurrentValue && isPromiseLike(currentValue))
                    clearSupersededAsyncAtomCoordinator(target, store)
                setValueInData(target, value, store)
                if (hasAtomCommitObservers(target, store)) {
                    entries.push(
                        forestEntry(
                            store,
                            [target],
                            undefined,
                            undefined,
                            undefined,
                        ),
                    )
                }
            } catch (error) {
                recordCommitError(errors, error)
            }
        }
        if (entries.length !== 0) {
            try {
                settleCommitForest(
                    entries,
                    undefined,
                    undefined,
                    "revalidate",
                    errors,
                )
            } catch (error) {
                recordCommitError(errors, error)
            }
        }
    }

    const publishWrite = (
        target: Atom<any>,
        value: any,
        requestGeneration: number,
        errors: CommitErrors,
        copyStores: boolean,
        refreshedAt?: number,
    ): void => {
        if (globalState) {
            publishGlobalWrite(
                target,
                value,
                requestGeneration,
                errors,
                copyStores,
                refreshedAt,
            )
        } else {
            publishLocalWrite(target, value, data)
        }
    }

    const publishAdmittedWrite = (
        target: Atom<any>,
        value: any,
        requestGeneration: number,
        copyStores: boolean,
    ): boolean => {
        if (!current(requestGeneration)) return false
        const errors = createCommitErrors()
        publishWrite(target, value, requestGeneration, errors, copyStores)
        throwCommitError(errors)
        return true
    }

    const allocateMeta = (isRevalidating: boolean): CacheMeta => {
        if (!IS_PROD && data.architectureInstrumentation)
            recordCacheMetaAllocation(data)
        return {
            isRevalidating,
            lastSuccessAt: lastSuccessTime,
            maxAge: getMaxAge(),
            staleWhileRevalidate: getSWR(),
            staleIfError: getStaleIfError(),
        }
    }

    const updateMeta = (requestGeneration: number): boolean => {
        const meta = allocateMeta(revalidating)
        return publishAdmittedWrite(metaAtom, meta, requestGeneration, false)
    }

    const isPastStaleIfErrorWindow = () =>
        Date.now() - lastSuccessTime >= getMaxAge() + getStaleIfError()

    const validateRevalidatedValue = (value: any): boolean => {
        if (!state.schema) return true
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

    const setAndPropagate = (
        value: any,
        requestGeneration: number,
        errors: CommitErrors,
        refreshedAt?: number,
    ): void => {
        if (globalState) {
            publishGlobalWrite(
                state,
                value,
                requestGeneration,
                errors,
                !isPromiseLike(value),
                refreshedAt,
            )
            return
        }
        const currentValue = data.values.get(state)
        const hasCurrentValue =
            currentValue !== undefined || data.values.has(state)
        const valueIsPromise = isPromiseLike(value)
        const areEqual =
            hasCurrentValue &&
            (valueIsPromise || isPromiseLike(currentValue)
                ? currentValue === value
                : state.equal(currentValue, value))
        if (areEqual) {
            if (refreshedAt !== undefined)
                cacheState.recordWrite(state, data, refreshedAt)
            return
        }
        publishLocalWrite(state, value, data)
    }

    /**
     * One resolved timer transition has one monomorphic engine shape. The
     * operation retains the historical value and metadata commit boundaries
     * by invoking their propagation primitives in order from the plan's apply
     * phase; equal-value freshness is recorded in that same phase rather than
     * opening its own plan.
     */
    const commitRevalidation = (
        value: any,
        shouldWriteValue: boolean,
        requestGeneration: number,
        refreshedAt: number | undefined,
    ): boolean => {
        const errors = createCommitErrors()
        return runCommitPlan({
            data,
            settlement: NO_SETTLEMENT,
            admit: () => current(requestGeneration),
            apply: () => {
                if (shouldWriteValue) {
                    setAndPropagate(
                        value,
                        requestGeneration,
                        errors,
                        refreshedAt,
                    )
                }
                // A value subscriber can revoke this controller, and global
                // settlement records rather than throws observer failures.
                // Both conditions historically prevented metadata-off.
                if (errors.hasError || !current(requestGeneration)) return

                const idleMeta = allocateMeta(false)
                publishWrite(
                    metaAtom,
                    idleMeta,
                    requestGeneration,
                    errors,
                    false,
                )
            },
            onSets: NO_ON_SETS,
            errors,
            report: undefined,
        })
    }

    const getValueStore = (): StoreData => {
        if (globalState) {
            for (const store of globalState.stores) return store
        }
        return data
    }

    const tick = () => {
        if (revalidating || cancelled) return
        if (typeof state.defaultValue !== "function") return
        const requestGeneration = ++generation
        const valueStore = getValueStore()
        if (valueStore.values.has(state)) {
            const currentValue = valueStore.values.get(state)
            if (!isPromiseLike(currentValue)) lastGoodValue = currentValue
        }
        const value = (state.defaultValue as () => any)()
        if (isPromiseLike(value)) {
            revalidating = true
            const activeMeta = allocateMeta(true)
            publishAdmittedWrite(metaAtom, activeMeta, requestGeneration, false)
            const swr = activeMeta.staleWhileRevalidate

            const handleResolve = (resolved: any) => {
                if (!current(requestGeneration)) return
                revalidating = false
                if (!validateRevalidatedValue(resolved)) {
                    if (!current(requestGeneration)) return
                    commitRevalidation(
                        lastGoodValue,
                        lastGoodValue !== NO_VALUE,
                        requestGeneration,
                        undefined,
                    )
                    return
                }
                if (!current(requestGeneration)) return
                const refreshedAt = Date.now()
                lastSuccessTime = refreshedAt
                lastGoodValue = resolved
                commitRevalidation(
                    resolved,
                    true,
                    requestGeneration,
                    refreshedAt,
                )
            }

            const handleReject = () => {
                if (!current(requestGeneration)) return
                revalidating = false
                if (!isPastStaleIfErrorWindow() && lastGoodValue !== NO_VALUE) {
                    commitRevalidation(
                        lastGoodValue,
                        true,
                        requestGeneration,
                        undefined,
                    )
                } else {
                    commitRevalidation(
                        value,
                        true,
                        requestGeneration,
                        undefined,
                    )
                }
            }

            if (swr > 0) {
                let timeoutRef: ReturnType<typeof setTimeout> | undefined
                if (Number.isFinite(swr)) {
                    timeoutRef = setTimeout(() => {
                        pendingTimeouts.delete(timeoutRef!)
                        if (!current(requestGeneration) || !revalidating) {
                            return
                        }
                        publishAdmittedWrite(
                            state,
                            value,
                            requestGeneration,
                            !isPromiseLike(value),
                        )
                    }, swr)
                    pendingTimeouts.add(timeoutRef)
                }
                value.then(
                    resolved => {
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
                publishAdmittedWrite(
                    state,
                    value,
                    requestGeneration,
                    !isPromiseLike(value),
                )
                value.then(handleResolve, handleReject)
            }
            return
        }

        if (!validateRevalidatedValue(value)) return
        if (!current(requestGeneration)) return
        const refreshedAt = Date.now()
        lastSuccessTime = refreshedAt
        lastGoodValue = value
        commitRevalidation(value, true, requestGeneration, refreshedAt)
    }

    const startInterval = () => {
        currentInterval = setInterval(tick, getMaxAge())
    }

    const cleanup = () => {
        if (cancelled) return
        cancelled = true
        generation++
        if (currentInterval !== undefined) clearInterval(currentInterval)
        for (const timeout of pendingTimeouts) clearTimeout(timeout)
        pendingTimeouts.clear()
        let firstError: unknown
        let hasError = false
        for (const unsubscribe of configUnsubs) {
            try {
                unsubscribe()
            } catch (error) {
                if (!hasError) {
                    firstError = error
                    hasError = true
                }
            }
        }
        if (hasError) throw firstError
    }

    try {
        startInterval()
        updateMeta(generation)
        if (!current(generation)) {
            cleanup()
            return
        }
        if (isReactive(state.maxAge)) {
            configUnsubs.push(
                subscribeReactive(
                    state.maxAge as any,
                    () => {
                        if (currentInterval !== undefined) {
                            clearInterval(currentInterval)
                        }
                        startInterval()
                        updateMeta(generation)
                    },
                    false,
                    data,
                ),
            )
        }
        if (
            state.staleWhileRevalidate &&
            isReactive(state.staleWhileRevalidate)
        ) {
            configUnsubs.push(
                subscribeReactive(
                    state.staleWhileRevalidate as any,
                    () => updateMeta(generation),
                    false,
                    data,
                ),
            )
        }
        if (state.staleIfError && isReactive(state.staleIfError)) {
            configUnsubs.push(
                subscribeReactive(
                    state.staleIfError as any,
                    () => updateMeta(generation),
                    false,
                    data,
                ),
            )
        }
    } catch (error) {
        try {
            cleanup()
        } catch {}
        throw error
    }

    if (globalState) {
        const controller = {
            cleanup,
            refCount: 1,
            active: () => !cancelled,
        }
        globalState.cacheController = controller
        installStoreRelease(state, data, () => {
            if (controller.refCount <= 0) return
            controller.refCount--
            if (controller.refCount === 0) {
                try {
                    controller.cleanup()
                } finally {
                    if (globalState.cacheController === controller) {
                        globalState.cacheController = undefined
                    }
                }
                return
            }

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
                controller.cleanup()
            } catch (error) {
                firstError = error
                hasError = true
            }
            controller.refCount = 0
            if (globalState.cacheController === controller) {
                globalState.cacheController = undefined
            }
            for (const survivor of survivors) {
                try {
                    retain(state, survivor, subscribeReactive)
                } catch (error) {
                    if (!hasError) {
                        firstError = error
                        hasError = true
                    }
                }
            }
            if (hasError) throw firstError
        })
        return
    }

    installStoreRelease(state, data, cleanup)
}

const stopGlobal = (state: InternalGlobalAtom<any>): void => {
    const controller = state.cacheController
    if (!controller) return
    try {
        controller.cleanup()
    } finally {
        controller.refCount = 0
        if (state.cacheController === controller) {
            state.cacheController = undefined
        }
    }
}

export const cacheController = {
    retain,
    release,
    expireIfStale,
    stopGlobal,
}
