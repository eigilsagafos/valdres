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
} from "./mountAtom"
import {
    propagateDirtySelectors,
    propagateUpdatedAtoms,
} from "./propagateUpdatedAtoms"
import { setValueInData } from "./setValueInData"

// Shared WeakSet for circular dependency detection — safe to reuse because
// evaluation is synchronous and each selector adds/deletes itself.
const sharedCircularDepSet = new WeakSet()

class SuspendAndWaitForResolveError extends Error {
    promise: Promise<any>
    constructor(promise: Promise<any>) {
        super()
        this.promise = promise
    }
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

    // Abort any in-flight evaluation for this selector in this store,
    // then create a fresh AbortController for the new evaluation.
    const prevController = data.abortControllers.get(selector)
    if (prevController) prevController.abort()
    const abortController = new AbortController()
    data.abortControllers.set(selector, abortController)

    let result
    try {
        // @ts-ignore, @ts-todo
        result = selector.get(state => {
            // Deferred get calls (setTimeout, after await) use late binding
            if (evaluationComplete) {
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
        }, { signal: abortController.signal, storeId: data.id })
    } catch (error) {
        if (error instanceof SuspendAndWaitForResolveError) {
            result = error
        } else if (error instanceof SelectorEvaluationError) {
            throw error
        } else {
            throw new SelectorEvaluationError(error)
        }
    }

    evaluationComplete = true

    // Check if dep count also matches (handles removed deps)
    if (!depsChanged && currentDependencies && currentDependencies.size !== updatedDepsArray.length) {
        depsChanged = true
    }

    if (depsChanged || !currentDependencies) {
        const updatedDependencies = new Set<State<any>>(updatedDepsArray)
        const prev = currentDependencies ?? new Set<State<any>>()
        for (const state of updatedDependencies) {
            if (!prev.has(state)) {
                const set = getOrInitDependentsSet(state, data)
                set.add(selector)
                if (addedDepsOut) addedDepsOut.add(state)
            }
        }
        for (const state of prev) {
            if (!updatedDependencies.has(state)) {
                const set = getOrInitDependentsSet(state, data)
                set.delete(selector)
                if (removedDepsOut) removedDepsOut.add(state)
            }
        }
        data.stateDependencies.set(selector, updatedDependencies)
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
            if (data.values.has(selector) && data.values.get(selector) !== value) return
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
            cleanUpRejectedPromise(selector, data, value as Promise<any>)
        })
        return value
    } else {
        return value
    }
}

export const initSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet = sharedCircularDepSet,
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
