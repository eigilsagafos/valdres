import type { Atom, CacheMeta } from "../types/Atom"
import type { InternalGlobalAtom } from "../types/InternalGlobalAtom"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { isGlobalAtom } from "../utils/isGlobalAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isReactive, resolveReactive } from "../utils/resolveReactive"
import { cacheState } from "./cacheState"
import { runCommitPlan } from "./commitEngine"
import { createCommitErrors, recordCommitError } from "./commitErrors"
import { SETTLE_DEFAULT } from "./commitIntents"
import { equal } from "./equal"
import { hasAtomCommitObservers } from "./hasAtomCommitObservers"
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

const commitLocalWrite = (
    state: Atom<any>,
    value: any,
    data: StoreData,
    admit: () => boolean,
): boolean => {
    const settlement = hasAtomCommitObservers(state, data)
        ? {
              kind: "update" as const,
              atoms: [state],
              settle: settleCommit,
              flags: SETTLE_DEFAULT,
          }
        : { kind: "none" as const }
    return runCommitPlan({
        data,
        settlement,
        admit,
        apply: () => setValueInData(state, value, data),
        onSets: [],
        errors: createCommitErrors(),
        report: "revalidate",
    })
}

const commitFreshness = (
    state: Atom<any>,
    data: StoreData,
    refreshedAt: number,
    admit: () => boolean,
): boolean =>
    runCommitPlan({
        data,
        settlement: { kind: "none" },
        admit,
        apply: () => cacheState.recordWrite(state, data, refreshedAt),
        onSets: [],
        errors: createCommitErrors(),
        report: undefined,
    })

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
    if (isGlobalAtom(atom)) {
        if (atom.cacheController !== undefined) return false
    } else if (cacheState.peek(state, data)?.release !== undefined) {
        return false
    }
    const entry = cacheState.peek(state, data)
    const lastWriteAt = entry?.lastWriteAt
    if (lastWriteAt === undefined) return false
    const ttl =
        typeof maxAge === "number" ? maxAge : resolveReactive(maxAge, data)
    if (Date.now() - lastWriteAt <= ttl) return false

    // Deliberately unpublished: a cold read invalidates the stale cache and
    // immediately falls through to ordinary initialization. Opening a commit
    // here would make store.get() observable through onCommitEnd.
    data.values.delete(state)
    cacheState.clearWrite(atom, data)
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
                commitLocalWrite(
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

    const commitGlobalWrite = (
        target: Atom<any>,
        value: any,
        requestGeneration: number,
        refreshedAt?: number,
    ): boolean => {
        const snapshot = [...globalState!.stores]
        const entries: {
            data: StoreData
            updatedAtoms: Atom<any>[]
            deleted: undefined
            unsetAtoms: undefined
            children: undefined
        }[] = []
        const errors = createCommitErrors()
        return runCommitPlan({
            data,
            settlement: {
                kind: "forest",
                entries,
                globalUpdates: undefined,
                settle: settleCommitForest,
            },
            admit: () => current(requestGeneration),
            apply: () => {
                for (const store of snapshot) {
                    if (!current(requestGeneration)) break
                    try {
                        const currentValue = store.values.get(target)
                        const hasCurrentValue =
                            currentValue !== undefined ||
                            store.values.has(target)
                        const valueIsPromise = isPromiseLike(value)
                        const areEqual =
                            hasCurrentValue &&
                            (valueIsPromise || isPromiseLike(currentValue)
                                ? currentValue === value
                                : target.equal(currentValue, value))
                        if (areEqual) {
                            if (refreshedAt !== undefined) {
                                cacheState.recordWrite(
                                    target,
                                    store,
                                    refreshedAt,
                                )
                            }
                            continue
                        }
                        setValueInData(target, value, store)
                        if (hasAtomCommitObservers(target, store)) {
                            entries.push({
                                data: store,
                                updatedAtoms: [target],
                                deleted: undefined,
                                unsetAtoms: undefined,
                                children: undefined,
                            })
                        }
                    } catch (error) {
                        recordCommitError(errors, error)
                    }
                }
            },
            onSets: [],
            errors,
            report: "revalidate",
        })
    }

    const commitWrite = (
        target: Atom<any>,
        value: any,
        requestGeneration: number,
    ): boolean =>
        globalState
            ? commitGlobalWrite(target, value, requestGeneration)
            : commitLocalWrite(target, value, data, () =>
                  current(requestGeneration),
              )

    const updateMeta = (requestGeneration: number): boolean => {
        const meta: CacheMeta = {
            isRevalidating: revalidating,
            lastSuccessAt: lastSuccessTime,
            maxAge: getMaxAge(),
            staleWhileRevalidate: getSWR(),
            staleIfError: getStaleIfError(),
        }
        return commitWrite(metaAtom, meta, requestGeneration)
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
        refreshedAt?: number,
    ): boolean => {
        if (globalState) {
            return commitGlobalWrite(
                state,
                value,
                requestGeneration,
                refreshedAt,
            )
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
            return refreshedAt === undefined
                ? current(requestGeneration)
                : commitFreshness(state, data, refreshedAt, () =>
                      current(requestGeneration),
                  )
        }
        return commitLocalWrite(state, value, data, () =>
            current(requestGeneration),
        )
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
            updateMeta(requestGeneration)
            const swr = getSWR()

            const handleResolve = (resolved: any) => {
                if (!current(requestGeneration)) return
                revalidating = false
                if (!validateRevalidatedValue(resolved)) {
                    if (!current(requestGeneration)) return
                    if (lastGoodValue !== NO_VALUE) {
                        setAndPropagate(lastGoodValue, requestGeneration)
                    }
                    updateMeta(requestGeneration)
                    return
                }
                if (!current(requestGeneration)) return
                const refreshedAt = Date.now()
                lastSuccessTime = refreshedAt
                lastGoodValue = resolved
                setAndPropagate(resolved, requestGeneration, refreshedAt)
                updateMeta(requestGeneration)
            }

            const handleReject = () => {
                if (!current(requestGeneration)) return
                revalidating = false
                if (!isPastStaleIfErrorWindow() && lastGoodValue !== NO_VALUE) {
                    setAndPropagate(lastGoodValue, requestGeneration)
                } else {
                    setAndPropagate(value, requestGeneration)
                }
                updateMeta(requestGeneration)
            }

            if (swr > 0) {
                let timeoutRef: ReturnType<typeof setTimeout> | undefined
                if (Number.isFinite(swr)) {
                    timeoutRef = setTimeout(() => {
                        pendingTimeouts.delete(timeoutRef!)
                        if (!current(requestGeneration) || !revalidating) {
                            return
                        }
                        setAndPropagate(value, requestGeneration)
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
                setAndPropagate(value, requestGeneration)
                value.then(handleResolve, handleReject)
            }
            return
        }

        if (!validateRevalidatedValue(value)) return
        if (!current(requestGeneration)) return
        const refreshedAt = Date.now()
        lastSuccessTime = refreshedAt
        lastGoodValue = value
        setAndPropagate(value, requestGeneration, refreshedAt)
        updateMeta(requestGeneration)
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
