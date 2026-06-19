import { SchemaValidationError } from "../errors/SchemaValidationError"
import { SelectorCircularDependencyError } from "../errors/SelectorCircularDependencyError"
import { SelectorEvaluationError } from "../errors/SelectorEvaluationError"
import type { Atom } from "../types/Atom"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import {
    SuspendAndWaitForResolveError,
    cleanUpRejectedPromise,
    getOrInitDependentsSet,
    lateGet,
    pendingAsyncDeps,
} from "./asyncDependencyTracking"
import { getState } from "./getState"
import { isLive, onLiveDependencyRemoved, unmountOrphanedDeps } from "./mountAtom"
import {
    changeListenerRegistry,
    hasSelectorChangeListener,
    reportSelectorChanges,
} from "./notifyChangeListeners"
import {
    propagateAtomUpdate,
    propagateDirtySelectors,
} from "./propagateUpdatedAtoms"
import { reportAsyncSchemaError } from "./reportAsyncSchemaError"
import { setValueInData } from "./setValueInData"
import { validateResolvedValue } from "./validateResolvedValue"
import { validateSchema } from "./validateSchema"

export { isSuspendError } from "./asyncDependencyTracking"

// Static signal for known-sync selectors — avoids AbortController allocation.
const neverAbortedSignal = new AbortController().signal

// Per-store options object reused whenever a selector evaluation needs no
// live AbortController — i.e. known-sync selectors and selectors that don't
// declare the options parameter. Carries the real `storeId` and a permanently
// non-aborted `signal`. Cached per store so reuse costs one WeakMap lookup
// instead of an allocation.
const syncOptionsCache = new WeakMap<StoreData, { signal: AbortSignal; storeId: string }>()
const getSyncOptions = (data: StoreData) => {
    let cached = syncOptionsCache.get(data)
    if (!cached) {
        cached = { signal: neverAbortedSignal, storeId: data.id }
        syncOptionsCache.set(data, cached)
    }
    return cached
}

/**
 * Holder for dep-change tracking during propagation. The Sets inside are
 * allocated lazily by `evaluateSelector` only when deps actually changed —
 * the steady-state case (same deps re-evaluated) does no allocation here.
 * Callers should clear `added` / `removed` to `undefined` before reuse.
 */
export type DepsChange = {
    added?: Set<State>
    removed?: Set<State>
}

export const evaluateSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<Selector> = data.circularDepSet,
    depsChangeOut?: DepsChange,
) => {
    const currentDependencies = data.stateDependencies.get(selector)
    // Deduped set of deps read this evaluation. Using a Set (not an array)
    // makes change-detection robust to a dependency read MORE THAN ONCE in one
    // evaluation (e.g. `cond ? get(a) + get(b) : get(a) + get(a)`): comparing
    // against an array's length (which counts duplicates) previously masked a
    // removed dependency whenever a duplicate kept the raw count equal, leaving
    // a stale reverse edge in stateDependents. It also avoids the later
    // array→Set conversion. Insertion order is preserved (Set semantics).
    const updatedDeps = new Set<State<any>>()
    let depsChanged = false
    let evaluationComplete = false

    // Revoke any previous late-binding closure for this selector so that
    // deferred get calls from old evaluations become read-only.
    const latestEvalContext = data.latestEvalContext
    const prevCtx = latestEvalContext.get(selector)
    if (prevCtx) prevCtx.revoked = true
    const evalCtx = { revoked: false }
    latestEvalContext.set(selector, evalCtx)

    if (circularDependencySet.has(selector)) {
        throw new SelectorCircularDependencyError()
    }
    circularDependencySet.add(selector)

    try {
        // Abort signal support: `options.signal` is a lazy getter that only
        // allocates an AbortController when the selector body reads it. Most
        // selectors don't, so first eval pays nothing extra. After eval,
        // handleSelectorResult marks the entry as `false` for sync results,
        // letting subsequent evaluations reuse a shared cached options object.
        // For async results the controller stays, and re-evaluation aborts it.
        let options: { signal: AbortSignal; storeId: string }
        // Fast path for selectors that don't declare a second (options)
        // parameter. `get.length < 2` is a heuristic for "doesn't use options",
        // not a guarantee: it's true for `(get) => …`, but NOT for an options
        // param written with a default value (`(get, opts = {})`) or as a rest
        // param, and it can't see a body that reaches `arguments[1]`. In every
        // such case the selector still receives a valid options object with the
        // correct `storeId` — only `signal` is a permanently non-abortable
        // placeholder. Selectors that need a live abort signal must declare
        // options positionally or via destructuring (`(get, opts)`,
        // `(get, { signal })`), which is arity 2 and takes the full path below.
        // The fast path avoids the per-eval accessor-object allocation and the
        // abortControllers WeakMap traffic for the common case.
        if ((selector.get as (...args: any[]) => any).length < 2) {
            options = getSyncOptions(data)
        } else {
            const prev = data.abortControllers.get(selector)
            if (prev === false) {
                // Known-sync selector — use cached options, no allocation
                options = getSyncOptions(data)
            } else {
                if (prev) prev.abort()
                let controller: AbortController | undefined
                // Capture this eval's context so that if `signal` is read after
                // the selector has already been superseded by a re-eval, we
                // return a pre-aborted signal. This preserves abort semantics
                // for selectors that touch `opts.signal` only after an await.
                const myEvalCtx = evalCtx
                options = {
                    storeId: data.id,
                    get signal() {
                        if (!controller) {
                            controller = new AbortController()
                            if (myEvalCtx.revoked) {
                                controller.abort()
                            } else {
                                data.abortControllers.set(selector, controller)
                            }
                        }
                        return controller.signal
                    },
                }
            }
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
                updatedDeps.add(state)
                if (!depsChanged && (!currentDependencies || !currentDependencies.has(state))) {
                    depsChanged = true
                }
                if (isPromiseLike(value))
                    throw new SuspendAndWaitForResolveError(value)

                return value
            }, options)
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

        const isAsyncResult =
            result instanceof SuspendAndWaitForResolveError || isPromiseLike(result)

        // For sync selectors, check if dep count changed (handles removed deps).
        // For async selectors, skip — the dep count is incomplete until the
        // promise resolves.
        if (!isAsyncResult && !depsChanged && currentDependencies && currentDependencies.size !== updatedDeps.size) {
            depsChanged = true
        }

        if (depsChanged || !currentDependencies) {
            // Seed the active selector-update pass's liveness reconcile with this
            // selector whenever its dep SET changed — covering BOTH the
            // propagation-loop path and lazy re-inits through `get`. Added deps
            // are covered via this selector's downward closure; removed deps are
            // seeded individually below to cover torn-down subtrees. Only when an
            // EXISTING selector changed — a first init is reached (and seeded)
            // through whatever live selector just read it.
            if (data.livenessSeeds && currentDependencies) {
                data.livenessSeeds.add(selector)
                // A lazy re-init (no depsChangeOut) commits these edges without
                // going through the propagation loop's onLiveDependency* calls,
                // so the incremental count never sees them — arm the reconcile.
                // (This is what left cyclic/self-cyclic subtrees mis-counted
                // when only the propagation-loop, removal-armed path ran.)
                if (!depsChangeOut) data.livenessNeedsReconcile = true
            }
            const updatedDependencies = new Set<State<any>>(updatedDeps)
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
                    if (depsChangeOut) {
                        if (!depsChangeOut.added) depsChangeOut.added = new Set<State>()
                        depsChangeOut.added.add(state)
                    }
                }
            }
            if (!isAsyncResult) {
                for (const state of prev) {
                    if (!updatedDependencies.has(state)) {
                        const set = getOrInitDependentsSet(state, data)
                        set.delete(selector)
                        if (depsChangeOut) {
                            if (!depsChangeOut.removed) depsChangeOut.removed = new Set<State>()
                            depsChangeOut.removed.add(state)
                        }
                        // Removed dep: seed its torn-down subtree for reconcile
                        // and arm the pass — a removal is what the incremental
                        // path can't always settle (cyclic leak / transient
                        // freeze), regardless of which path drove it.
                        if (data.livenessSeeds) {
                            data.livenessSeeds.add(state)
                            data.livenessNeedsReconcile = true
                        }
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
            allDepsThisEval = new Set<State>(updatedDeps)
            pendingAsyncDeps.set(result, allDepsThisEval)
        }

        return result
    } finally {
        // The set is reused across selector evaluations within the same
        // store, so cleanup must run on every exit path — including
        // SelectorEvaluationError rethrows and any throw from the
        // dep-tracking code above. Otherwise the selector leaks into the
        // set and the next read trips a spurious cycle check.
        circularDependencySet.delete(selector)
    }
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
            // If deps were cleaned up (unsubscribe GC), bail entirely.
            if (!data.stateDependencies.has(selector)) return
            if (data.values.has(selector) && data.values.get(selector) !== promise) return
            const initializedAtomsSet = new Set<Atom>()
            const res = initSelector(selector, data, initializedAtomsSet)
            if (initializedAtomsSet.size > 0) {
                propagateAtomUpdate([...initializedAtomsSet], data, false, undefined, "async-set")
            }
            return res
        }).catch(err => {
            cleanUpRejectedPromise(selector, data, promise)
            // Report schema validation failures (thrown from the sync
            // re-evaluation inside initSelector) instead of swallowing them,
            // consistent with the native-promise path below.
            if (err instanceof SchemaValidationError) reportAsyncSchemaError(err)
        })
        return promise
    } else if (isPromiseLike(value)) {
        // When a promise is returned when initializing a selector we suspend,
        // then we retry when the promise resolves.
        value.then(resolved => {
            // Guard: selector was cleaned up by unsubscribe GC
            if (!data.stateDependencies.has(selector)) {
                pendingAsyncDeps.delete(value)
                return
            }
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
                    const selectorIsLive = isLive(selector, data)
                    for (const dep of currentDeps) {
                        if (!evalDeps.has(dep)) {
                            currentDeps.delete(dep)
                            const dependents = data.stateDependents.get(dep)
                            if (dependents) dependents.delete(selector)
                            if (selectorIsLive) {
                                onLiveDependencyRemoved(dep, data)
                            }
                            unmountOrphanedDeps(dep, data)
                        }
                    }
                }
            }

            // Async validation can't throw to a caller; on failure it's
            // reported and we clean up so the invalid value never commits.
            // Consistent with the atom async paths.
            if (!validateResolvedValue(selector, resolved, data)) {
                pendingAsyncDeps.delete(value as Promise<any>)
                cleanUpRejectedPromise(selector, data, value as Promise<any>)
                return
            }
            // @ts-ignore
            setValueInData(selector, resolved, data)
            const dependents = data.stateDependents.get(selector)
            const subs = data.subscriptions.get(selector)
            if (
                (subs && subs.size > 0) ||
                (dependents && dependents.size > 0)
            ) {
                // Collect downstream selectors that recompute as a result, so a
                // `{ selectors: true }` listener sees them alongside this
                // selector. Off the hot path unless a selector listener exists on
                // this store's chain (not merely some unrelated root store).
                const changedSelectors =
                    changeListenerRegistry.selectorCount !== 0 &&
                    hasSelectorChangeListener(data)
                        ? new Set<Selector>()
                        : undefined
                propagateDirtySelectors(
                    [],
                    new Set(dependents),
                    data,
                    new Set(subs),
                    new Map(),
                    false,
                    undefined,
                    changedSelectors,
                )
                if (changedSelectors) {
                    // This selector itself just resolved from a pending promise
                    // to `resolved` — a genuine value change. Report it (and the
                    // downstream it triggered) as an "async-set" batch.
                    changedSelectors.add(selector)
                    reportSelectorChanges(changedSelectors, data, "async-set")
                }
            }
        }).catch(() => {
            pendingAsyncDeps.delete(value as Promise<any>)
            cleanUpRejectedPromise(selector, data, value as Promise<any>)
        })
        return value
    } else {
        // Sync result — mark as known-sync so subsequent evaluations skip
        // AbortController allocation on the hot path. Only meaningful for
        // selectors that read options (arity >= 2); arity-<2 selectors bypass
        // the abortControllers path entirely, so don't pollute the map.
        if ((selector.get as (...args: any[]) => any).length >= 2) {
            data.abortControllers.set(selector, false)
        }
        return validateSchema(selector, value, data)
    }
}

export const initSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<Selector> = data.circularDepSet,
): boolean => {
    const existingValue = data.values.get(selector)
    const updatedValue = evaluate(
        selector,
        data,
        initializedAtomsSet,
        circularDependencySet,
    )

    // Promises should use reference equality — deep equal treats all
    // promises as structurally identical (both have zero own keys).
    const areEqual = isPromiseLike(existingValue) || isPromiseLike(updatedValue)
        ? existingValue === updatedValue
        : selector.equal(existingValue as V, updatedValue as V)

    if (areEqual) {
        return false
    } else {
        setValueInData<V>(selector, updatedValue as V, data)
        return true
    }
}

const evaluate = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<Selector>,
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
