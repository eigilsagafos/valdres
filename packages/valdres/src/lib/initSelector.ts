import { SelectorCircularDependencyError } from "../errors/SelectorCircularDependencyError"
import { SelectorEvaluationError } from "../errors/SelectorEvaluationError"
import type { Atom } from "../types/Atom"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { getState } from "./getState"
import {
    isTransitivelySubscribed,
    mountTransitiveDeps,
    unmountOrphanedDeps,
} from "./mountAtom"
import {
    propagateDirtySelectors,
    propagateUpdatedAtoms,
} from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"

/**
 * Thrown by getState when a selector needs initialization during trampoline
 * evaluation. The trampoline catches this and evaluates the dependency first.
 */
export class NeedsInitError {
    selector: Selector
    constructor(selector: Selector) {
        this.selector = selector
    }
}

/** Recursion depth for selector initialization. Exported for getState to check. */
export let _evalDepth = 0

/** Whether we're inside a trampoline loop (prevents nested trampolines). */
let _inTrampoline = false

/** Max selector init recursion depth before switching to trampoline mode.
 *  Each level uses ~8-10 JS stack frames, so 100 levels ≈ 800-1000 frames,
 *  safely under the typical ~10000 frame limit. */
export const MAX_EVAL_DEPTH = 100

// Tracks all deps (sync + async) for each pending async selector evaluation.
// Keyed by the Promise returned by the async selector. When the promise
// resolves, handleSelectorResult reads this to reconcile stale deps.
const pendingAsyncDeps = new WeakMap<Promise<any>, Set<State>>()

// Shared WeakSet for circular dependency detection — safe to reuse because
// evaluation is synchronous and each selector adds/deletes itself.
const sharedCircularDepSet = new WeakSet()

// Static signal for known-sync selectors — avoids AbortController allocation.
const neverAbortedSignal = new AbortController().signal

// Cache the sync options object per store to avoid allocation on the hot path.
const syncOptionsCache = new WeakMap<StoreData, { signal: AbortSignal; storeId: string }>()

class SuspendAndWaitForResolveError extends Error {
    promise: Promise<any>
    constructor(promise: Promise<any>) {
        super()
        this.promise = promise
    }
}

/** Type guard for SuspendAndWaitForResolveError. Exported so consumers
 *  (e.g. the jotai adapter) can detect suspension without importing the class. */
export const isSuspendError = (
    e: unknown,
): e is { promise: Promise<any> } => {
    return e instanceof SuspendAndWaitForResolveError
}

const getOrInitDependentsSet = (
    state: State,
    data: StoreData,
): Set<State<any>> => {
    const set = data.stateDependents.get(state)
    if (set) return set
    const newSet = new Set<State>()
    data.stateDependents.set(state, newSet)
    return newSet
}

// Tracks the latest evaluation context per selector so that stale closures
// (from previous evaluations) can detect they are outdated and avoid
// registering phantom dependencies.
const latestEvalContext = new WeakMap<Selector, { revoked: boolean }>()

/**
 * Handle a deferred `get` call — one that runs after the synchronous
 * evaluation of the selector has already completed (e.g. inside a
 * setTimeout or after an await). Registers the dependency, mounts it
 * if the selector is transitively subscribed, and returns the value.
 */
const lateGet = (
    state: State,
    selector: Selector,
    data: StoreData,
) => {
    // Register dependency
    let deps = data.stateDependencies.get(selector)
    if (!deps) {
        deps = new Set()
        data.stateDependencies.set(selector, deps)
    }
    const isNewDep = !deps.has(state)
    if (isNewDep) {
        deps.add(state)
        const dependents = getOrInitDependentsSet(state, data)
        dependents.add(selector)
    }

    // Get the value (may throw for error-throwing selectors).
    // Atoms lazily initialized here are first-time accesses — no other
    // selector depends on them yet, so propagation is unnecessary.
    const lateInitSet = new Set<Atom>()
    try {
        return getState(state, data, lateInitSet)
    } finally {
        // Mount new dependencies if the selector is subscribed
        if (isNewDep && isTransitivelySubscribed(selector, data)) {
            mountTransitiveDeps(state, data)
        }
    }
}

export const evaluateSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet = sharedCircularDepSet,
    addedDepsOut?: Set<State>,
    removedDepsOut?: Set<State>,
) => {
    const currentDependencies = data.stateDependencies.get(selector)
    const updatedDepsArray: State<any>[] = []
    let depsChanged = false
    let evaluationComplete = false

    // Revoke any previous late-binding closure for this selector so that
    // deferred get calls from old evaluations become read-only.
    const prevCtx = latestEvalContext.get(selector)
    if (prevCtx) prevCtx.revoked = true
    const evalCtx = { revoked: false }
    latestEvalContext.set(selector, evalCtx)

    if (circularDependencySet.has(selector)) {
        throw new SelectorCircularDependencyError()
    }
    circularDependencySet.add(selector)

    // Abort signal support: on first eval we allocate an AbortController and
    // pass its signal to the selector. After eval, handleSelectorResult marks
    // the entry as `false` for sync results, so subsequent sync evaluations
    // skip allocation entirely (~140ns saved per eval on the hot path).
    // For async results the controller stays, and re-evaluation aborts it.
    const prev = data.abortControllers.get(selector)
    let options: { signal: AbortSignal; storeId: string }
    if (prev === false) {
        // Known-sync selector — use cached options, no allocation
        let cached = syncOptionsCache.get(data)
        if (!cached) {
            cached = { signal: neverAbortedSignal, storeId: data.id }
            syncOptionsCache.set(data, cached)
        }
        options = cached
    } else {
        if (prev) prev.abort()
        const abortController = new AbortController()
        data.abortControllers.set(selector, abortController)
        options = { signal: abortController.signal, storeId: data.id }
    }

    // Lazily populated: tracks ALL deps read during this evaluation (sync +
    // async). Only allocated when the result turns out to be a promise.
    let allDepsThisEval: Set<State> | undefined

    let result
    try {
        // @ts-ignore, @ts-todo
        result = selector.get(state => {
            // Deferred get calls (setTimeout, after await) use late binding
            if (evaluationComplete) {
                // Track for reconciliation (unless this is a stale closure)
                if (!evalCtx.revoked && allDepsThisEval) {
                    allDepsThisEval.add(state)
                }
                if (evalCtx.revoked) {
                    // Stale closure — the selector has been re-evaluated since
                    // this closure was created. Read the value without
                    // registering deps or mounting.
                    return getState(state, data, new Set<Atom>())
                }
                return lateGet(state, selector, data)
            }
            const value = getState(
                state,
                data,
                initializedAtomsSet,
                circularDependencySet,
            )
            updatedDepsArray.push(state)
            if (!depsChanged && (!currentDependencies || !currentDependencies.has(state))) {
                depsChanged = true
            }
            if (isPromiseLike(value))
                throw new SuspendAndWaitForResolveError(value)

            return value
        }, options)
    } catch (error) {
        if (error instanceof NeedsInitError) {
            // Clean up circular dependency tracking so retry works
            circularDependencySet.delete(selector)
            throw error
        }
        if (error instanceof SuspendAndWaitForResolveError) {
            result = error
        } else if (error instanceof SelectorEvaluationError) {
            throw error
        } else {
            throw new SelectorEvaluationError(error)
        }
    }

    evaluationComplete = true

    const isAsyncResult =
        result instanceof SuspendAndWaitForResolveError || isPromiseLike(result)

    // For sync selectors, check if dep count changed (handles removed deps).
    // For async selectors, skip — the dep count is incomplete until the
    // promise resolves.
    if (!isAsyncResult && !depsChanged && currentDependencies && currentDependencies.size !== updatedDepsArray.length) {
        depsChanged = true
    }

    if (depsChanged || !currentDependencies) {
        const updatedDependencies = new Set<State<any>>(updatedDepsArray)
        // For async selectors, retain all previous deps so they aren't
        // prematurely removed (and unmounted) before the continuation runs.
        // Stale deps are cleaned up when the promise resolves (see
        // the reconciliation logic in handleSelectorResult).
        if (isAsyncResult && currentDependencies) {
            for (const dep of currentDependencies) {
                updatedDependencies.add(dep)
            }
        }
        const prev = currentDependencies ?? new Set<State<any>>()
        for (const state of updatedDependencies) {
            if (!prev.has(state)) {
                const set = getOrInitDependentsSet(state, data)
                set.add(selector)
                if (addedDepsOut) addedDepsOut.add(state)
            }
        }
        if (!isAsyncResult) {
            for (const state of prev) {
                if (!updatedDependencies.has(state)) {
                    const set = getOrInitDependentsSet(state, data)
                    set.delete(selector)
                    if (removedDepsOut) removedDepsOut.add(state)
                }
            }
        }
        data.stateDependencies.set(selector, updatedDependencies)
    }

    // Store tracking set so handleSelectorResult can reconcile when the
    // promise resolves. Only needed for native-promise selectors —
    // SuspendAndWaitForResolveError re-evaluates via initSelector instead.
    if (isPromiseLike(result)) {
        // Build the tracking set from sync deps discovered so far. Late
        // `get` calls (after await) will add to this set dynamically.
        allDepsThisEval = new Set<State>(updatedDepsArray)
        pendingAsyncDeps.set(result, allDepsThisEval)
    }

    circularDependencySet.delete(selector)
    return result
}

const cleanUpRejectedPromise = <Value>(
    selector: Selector<Value>,
    data: StoreData,
    promise: Promise<any>,
) => {
    if (data.values.has(selector) && data.values.get(selector) !== promise) return
    data.values.delete(selector)
}

export const handleSelectorResult = <Value>(
    value: Value | Promise<Value> | SuspendAndWaitForResolveError,
    selector: Selector<Value>,
    data: StoreData,
) => {
    if (value instanceof SuspendAndWaitForResolveError) {
        // The selector was suspended — it threw before completing, so no
        // meaningful async work was started with the current signal. Clear
        // the AbortController so that when the dependency resolves and
        // propagation re-evaluates this selector, it won't spuriously
        // abort the signal.
        data.abortControllers.delete(selector)
        const promise = value.promise
        promise.then(() => {
            // Guard against stale promise — if the selector's value has been
            // replaced with a different value, this resolution is outdated.
            // If the value was deleted (e.g. moved to expired), still proceed.
            if (data.values.has(selector) && data.values.get(selector) !== promise) return
            const initializedAtomsSet = new Set<Atom>()
            const res = initSelector(selector, data, initializedAtomsSet)
            if (initializedAtomsSet.size > 0) {
                propagateUpdatedAtoms([...initializedAtomsSet], data)
            }
            return res
        }).catch(() => {
            cleanUpRejectedPromise(selector, data, promise)
        })
        return promise
    } else if (isPromiseLike(value)) {
        // When a promise is returned when initializing a selector we suspend,
        // then we retry when the promise resolves.
        value.then(resolved => {
            // Guard against stale promise
            if (data.values.has(selector) && data.values.get(selector) !== value) {
                pendingAsyncDeps.delete(value)
                return
            }

            // Reconcile deps: remove any that were carried forward from a
            // previous evaluation but not read in this one.
            const evalDeps = pendingAsyncDeps.get(value)
            if (evalDeps) {
                pendingAsyncDeps.delete(value)
                const currentDeps = data.stateDependencies.get(selector)
                if (currentDeps) {
                    for (const dep of currentDeps) {
                        if (!evalDeps.has(dep)) {
                            currentDeps.delete(dep)
                            const dependents = data.stateDependents.get(dep)
                            if (dependents) dependents.delete(selector)
                            unmountOrphanedDeps(dep, data)
                        }
                    }
                }
            }

            // @ts-ignore
            setValueInData(selector, resolved, data)
            const dependents = data.stateDependents.get(selector)
            const subs = data.subscriptions.get(selector)
            if (
                (subs && subs.size > 0) ||
                (dependents && dependents.size > 0)
            ) {
                propagateDirtySelectors(
                    [],
                    new Set(dependents),
                    data,
                    new Set(subs),
                    new Map(),
                )
            }
        }).catch(() => {
            pendingAsyncDeps.delete(value as Promise<any>)
            cleanUpRejectedPromise(selector, data, value as Promise<any>)
        })
        return value
    } else {
        // Sync result — mark as known-sync so subsequent evaluations
        // skip AbortController allocation on the hot path.
        data.abortControllers.set(selector, false)
        return value
    }
}

const initSelectorDirect = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<any>,
): boolean => {
    const existingValue = data.values.get(selector)
    const udpatedValue = evaluate(
        selector,
        data,
        initializedAtomsSet,
        circularDependencySet,
    )

    // Promises should use reference equality — deep equal treats all
    // promises as structurally identical (both have zero own keys).
    const areEqual = isPromiseLike(existingValue) || isPromiseLike(udpatedValue)
        ? existingValue === udpatedValue
        : selector.equal(existingValue as V, udpatedValue as V)

    if (areEqual) {
        return false
    } else {
        setValueInData<V>(selector, udpatedValue as V, data)
        return true
    }
}

/**
 * Iterative trampoline for initializing deeply nested selector chains.
 * Instead of recursing through getState → initSelector → evaluateSelector → getState,
 * getState throws NeedsInitError when it encounters an uninitialized selector
 * during trampoline mode. The trampoline catches this and evaluates deps first.
 */
const initSelectorTrampoline = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<any>,
): void => {
    const stack: Selector[] = [selector]
    const inStack = new Set<Selector>([selector])

    while (stack.length > 0) {
        const current = stack[stack.length - 1]!
        if (data.values.has(current)) {
            stack.pop()
            inStack.delete(current)
            continue
        }
        try {
            initSelectorDirect(
                current,
                data,
                initializedAtomsSet,
                circularDependencySet,
            )
            stack.pop()
            inStack.delete(current)
        } catch (e) {
            if (e instanceof NeedsInitError) {
                if (inStack.has(e.selector)) {
                    throw new SelectorCircularDependencyError()
                }
                stack.push(e.selector)
                inStack.add(e.selector)
            } else {
                throw e
            }
        }
    }
}

export const initSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet = sharedCircularDepSet,
): boolean => {
    const isTopLevel = _evalDepth === 0 && !_inTrampoline
    _evalDepth++
    const existingValue = data.values.get(selector)
    try {
        return initSelectorDirect(selector, data, initializedAtomsSet, circularDependencySet)
    } catch (e) {
        if (e instanceof NeedsInitError && isTopLevel) {
            // Depth limit was hit — switch to iterative trampoline
            _inTrampoline = true
            try {
                initSelectorTrampoline(selector, data, initializedAtomsSet, circularDependencySet)
            } finally {
                _inTrampoline = false
            }
            const newValue = data.values.get(selector)
            const areEqual = isPromiseLike(existingValue) || isPromiseLike(newValue)
                ? existingValue === newValue
                : selector.equal(existingValue as V, newValue as V)
            return !areEqual
        }
        throw e
    } finally {
        _evalDepth--
    }
}

const evaluate = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<any>,
) => {
    let tmpValue
    try {
        tmpValue = evaluateSelector(
            selector,
            data,
            initializedAtomsSet,
            circularDependencySet,
        )
    } catch (e) {
        if (e instanceof SelectorEvaluationError) e.track(selector)
        throw e
    }
    return handleSelectorResult<V>(tmpValue, selector, data)
}
