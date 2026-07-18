import { SchemaValidationError } from "../errors/SchemaValidationError"
import { SelectorCircularDependencyError } from "../errors/SelectorCircularDependencyError"
import { SelectorEvaluationError } from "../errors/SelectorEvaluationError"
import type { Atom } from "../types/Atom"
import type { GetValue } from "../types/GetValue"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type {
    SelectorEvaluationContext,
    StoreData,
} from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import {
    SuspendAndWaitForResolveError,
    cleanUpRejectedPromise,
    getOrInitDependentsSet,
    lateGet,
} from "./asyncDependencyTracking"
import { getState } from "./getState"
import {
    activateSelectorGraph,
    isLive,
    noteDependencyAdded,
    onLiveDependencyRemoved,
    unmountOrphanedDeps,
} from "./mountAtom"
import {
    noteDependencyGraphChanged,
    noteDependencyMaterialized,
} from "./noteDependencyGraphChanged"
import { cleanupOrphanedDeps } from "./cleanupOrphanedDeps"
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
import {
    getStateRevision,
    markColdSelectorCacheValidated,
    recordColdSelectorCache,
    trackStateRevision,
} from "./stateRevisions"
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

const rollbackFreshSelectorActivation = (
    selector: Selector,
    data: StoreData,
) => {
    cleanupOrphanedDeps(selector, data)
    // A selector that threw before committing its dependency set has no graph
    // for cleanupOrphanedDeps to remove, but the active marker is still owned
    // by the evaluation that speculatively added it.
    if (!isLive(selector, data)) data.selectorGraphActive.delete(selector)
}

export const initFreshActiveSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<Selector>,
): V => {
    data.selectorGraphActive.add(selector)
    try {
        initSelector(
            selector,
            data,
            initializedAtomsSet,
            circularDependencySet,
            true,
        )
        return data.values.get(selector)
    } catch (error) {
        rollbackFreshSelectorActivation(selector, data)
        throw error
    }
}

const rollbackFreshSelectorActivations = (
    selectors: Selector | Selector[] | undefined,
    data: StoreData,
) => {
    if (!selectors) return
    if (!Array.isArray(selectors)) {
        rollbackFreshSelectorActivation(selectors, data)
        return
    }
    for (let i = selectors.length - 1; i >= 0; i--) {
        rollbackFreshSelectorActivation(selectors[i], data)
    }
}

const lateGetWithRevisionSnapshot = (
    state: State,
    selector: Selector,
    data: StoreData,
    evalCtx: SelectorEvaluationContext,
) => {
    try {
        return lateGet(state, selector, data)
    } finally {
        // Native cold async selectors retain the revision observed by each
        // post-await read. Promise settlement must not stamp a stale result
        // with the dependency's newer revision.
        const revisions = evalCtx.asyncDependencyRevisions
        if (!evalCtx.revoked && revisions && !revisions.has(state)) {
            trackStateRevision(state, data)
            revisions.set(state, getStateRevision(state, data))
        }
    }
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

/** Selector bookkeeping owned by a read overlay rather than the committed
 * store. Transactions keep this state local so an aborted speculative read
 * cannot rewrite the store's dependency graph or publish an async result. */
export type SelectorEvaluationRuntime = {
    abortControllers: Map<Selector, AbortController | false>
    latestEvalContext: Map<Selector, SelectorEvaluationContext>
    stateDependencies: Map<Selector, Set<State>>
    readOverlayActive: boolean
}

export const evaluateSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<Selector> = data.circularDepSet,
    selectorGraphActive: boolean = false,
    depsChangeOut?: DepsChange,
    readOverlay?: GetValue,
    runtime?: SelectorEvaluationRuntime,
) => {
    const stateDependencies = runtime?.stateDependencies ?? data.stateDependencies
    const abortControllers = runtime?.abortControllers ?? data.abortControllers
    const currentDependencies = stateDependencies.get(selector)
    const tracksReverseEdges = !runtime && selectorGraphActive
    // A store that has never materialized a cold selector needs neither cache
    // validation nor promotion. Keep its live dependency getter close to the
    // original has/get path and out of the mixed cold/live branch below.
    const liveOnlyDependencyRead =
        tracksReverseEdges && !readOverlay && !data.coldSelectorCachesEnabled
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
    // Most selector bodies discover at most one fresh selector dependency. Keep
    // that common rollback token as a bare reference and allocate an array only
    // if a second fresh child is encountered.
    let activatedDuringEvaluation: Selector | Selector[] | undefined

    // Revoke any previous late-binding closure for this selector so that
    // deferred get calls from old evaluations become read-only.
    const latestEvalContext = runtime?.latestEvalContext ?? data.latestEvalContext
    const prevCtx = latestEvalContext.get(selector)
    if (prevCtx) prevCtx.revoked = true
    const evalCtx: SelectorEvaluationContext = {
        revoked: false,
        preserveSignalOnRevoke: false,
    }
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
            const prev = abortControllers.get(selector)
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
                                if (!myEvalCtx.preserveSignalOnRevoke) {
                                    controller.abort()
                                }
                            } else {
                                abortControllers.set(selector, controller)
                            }
                        }
                        return controller.signal
                    },
                }
            }
        }

        let result
        try {
            // @ts-ignore, @ts-todo
            result = selector.get(state => {
                // Deferred get calls (setTimeout, after await) use late binding
                if (evaluationComplete) {
                    // Track for reconciliation (unless this is a stale closure)
                    if (!evalCtx.revoked && evalCtx.asyncDeps) {
                        evalCtx.asyncDeps.add(state)
                    }
                    if (runtime) {
                        if (!evalCtx.revoked) {
                            runtime.stateDependencies.get(selector)?.add(state)
                        }
                        return readOverlay && runtime.readOverlayActive
                            ? readOverlay(state)
                            : getState(state, data, new Set<Atom>())
                    }
                    if (evalCtx.revoked) {
                        // Stale closure — the selector has been re-evaluated since
                        // this closure was created. Read the value without
                        // registering deps or mounting.
                        return getState(state, data, new Set<Atom>())
                    }
                    if (evalCtx.asyncDependencyRevisions) {
                        return lateGetWithRevisionSnapshot(
                            state,
                            selector,
                            data,
                            evalCtx,
                        )
                    }
                    return lateGet(state, selector, data)
                }
                let value
                if (readOverlay) {
                    value = readOverlay(state)
                } else if (liveOnlyDependencyRead) {
                    if (data.values.has(state)) {
                        // A live-only store has no forward-only cache to
                        // validate. Preserve the original WeakMap has/get path.
                        value = data.values.get(state)
                    } else if (isSelector(state)) {
                        // Every selector discovered below a live selector is
                        // itself live. Initialize it directly in graph mode.
                        // Only a genuinely new child needs parent-failure
                        // rollback bookkeeping.
                        const wasMaterialized =
                            data.stateDependencies.has(state)
                        value = initFreshActiveSelector(
                            state,
                            data,
                            initializedAtomsSet,
                            circularDependencySet,
                        )
                        if (!wasMaterialized) {
                            if (!activatedDuringEvaluation) {
                                activatedDuringEvaluation = state
                            } else if (
                                Array.isArray(activatedDuringEvaluation)
                            ) {
                                activatedDuringEvaluation.push(state)
                            } else {
                                activatedDuringEvaluation = [
                                    activatedDuringEvaluation,
                                    state,
                                ]
                            }
                        }
                    } else {
                        value = getState(
                            state,
                            data,
                            initializedAtomsSet,
                            circularDependencySet,
                        )
                    }
                } else {
                    // A selector first discovered while evaluating an active
                    // selector is already transitively live. When it has no
                    // committed cache/graph, initialize it directly as active;
                    // an existing cold cache still goes through getState first
                    // so revision validation precedes promotion.
                    const activateFreshSelector =
                        tracksReverseEdges &&
                        !data.values.has(state) &&
                        !data.stateDependencies.has(state) &&
                        isSelector(state) &&
                        !data.selectorGraphActive.has(state)
                    if (activateFreshSelector) {
                        value = initFreshActiveSelector(
                            state,
                            data,
                            initializedAtomsSet,
                            circularDependencySet,
                        )
                        if (!activatedDuringEvaluation) {
                            activatedDuringEvaluation = state
                        } else if (Array.isArray(activatedDuringEvaluation)) {
                            activatedDuringEvaluation.push(state)
                        } else {
                            activatedDuringEvaluation = [
                                activatedDuringEvaluation,
                                state,
                            ]
                        }
                    } else {
                        value = getState(
                            state,
                            data,
                            initializedAtomsSet,
                            circularDependencySet,
                        )
                    }
                }
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
            } else {
                rollbackFreshSelectorActivations(
                    activatedDuringEvaluation,
                    data,
                )
                if (error instanceof SelectorEvaluationError) throw error
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

        if (runtime && (depsChanged || !currentDependencies)) {
            // The overlay graph tracks async dependencies and re-evaluations,
            // but deliberately has no committed reverse edges or liveness.
            const updatedDependencies = isAsyncResult
                ? new Set<State<any>>(updatedDeps)
                : updatedDeps
            if (isAsyncResult && currentDependencies) {
                for (const dep of currentDependencies) {
                    updatedDependencies.add(dep)
                }
            }
            stateDependencies.set(selector, updatedDependencies)
        }

        if (!runtime && (depsChanged || !currentDependencies)) {
            // Invalidate topology-sensitive teardown caches once for this
            // dependency-set materialization or change (including an empty
            // selector re-materialized after cleanup).
            if (tracksReverseEdges) {
                noteDependencyGraphChanged(selector, data)
            } else {
                noteDependencyMaterialized(selector, data)
            }
            // Seed the active selector-update pass's liveness reconcile with this
            // selector whenever its dep SET changed — covering BOTH the
            // propagation-loop path and lazy re-inits through `get`. Added deps
            // are covered via this selector's downward closure; removed deps are
            // seeded individually below to cover torn-down subtrees. Only when an
            // EXISTING selector changed — a first init is reached (and seeded)
            // through whatever live selector just read it.
            if (
                tracksReverseEdges &&
                data.livenessPassActive &&
                currentDependencies
            ) {
                // Allocate the collector lazily on first seed — a no-churn pass
                // never reaches here, so it stays allocation-free.
                ;(data.livenessSeeds ??= new Set<State>()).add(selector)
                // A lazy re-init (no depsChangeOut) commits these edges without
                // going through the propagation loop's onLiveDependency* calls,
                // so the incremental count never sees them — arm the reconcile
                // UNCONDITIONALLY (it can mis-count even an acyclic graph because
                // the incremental path never ran for it).
                if (!depsChangeOut) data.livenessLazyArmed = true
            }
            // Sync selectors store the freshly-read dep set directly — no copy.
            // Async selectors need a separate set so previous deps can be merged
            // in (below) without mutating `updatedDeps`, which is still read as
            // the promise-tracking seed (`allDepsThisEval`) further down.
            const updatedDependencies = isAsyncResult
                ? new Set<State<any>>(updatedDeps)
                : updatedDeps
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
                    if (tracksReverseEdges) {
                        const set = getOrInitDependentsSet(state, data)
                        set.add(selector)
                        // New edge: propagate the mount-closure marker up so the
                        // mount/unmount walk-skip stays free of false negatives.
                        noteDependencyAdded(selector, state, data)
                        // A newly-read selector may itself have been only cold-
                        // cached. Promote its closure before liveness bookkeeping
                        // treats it as a live dependency.
                        activateSelectorGraph(state, data)
                        if (depsChangeOut) {
                            if (!depsChangeOut.added)
                                depsChangeOut.added = new Set<State>()
                            depsChangeOut.added.add(state)
                        }
                    }
                }
            }
            if (!isAsyncResult) {
                for (const state of prev) {
                    if (!updatedDependencies.has(state)) {
                        if (tracksReverseEdges) {
                            const set = getOrInitDependentsSet(state, data)
                            set.delete(selector)
                            if (depsChangeOut) {
                                if (!depsChangeOut.removed)
                                    depsChangeOut.removed = new Set<State>()
                                depsChangeOut.removed.add(state)
                            }
                        }
                        // Removed dep: arm the removal path only when the dropped
                        // dep is a SELECTOR. A directed cycle is selector-only —
                        // only selectors are keyed in stateDependencies; atoms and
                        // atom-family members are graph sinks (no out-edges), so
                        // removing one can be on no cycle and the incremental
                        // teardown is already exact. (selectorFamily members ARE
                        // selectors — isSelector is true for them, so they take
                        // this gated path.) For a selector dep we seed its
                        // torn-down subtree and arm; the end-of-pass reconcile is
                        // then still gated on regionHasCycle, so an acyclic selector
                        // removal also stays on the incremental path.
                        if (
                            tracksReverseEdges &&
                            data.livenessPassActive &&
                            isSelector(state)
                        ) {
                            ;(data.livenessSeeds ??= new Set<State>()).add(state)
                            data.livenessRemovalArmed = true
                        }
                    }
                }
            }
            data.stateDependencies.set(selector, updatedDependencies)
        }

        // Store the tracking set on this evaluation's identity so
        // handleSelectorResult can reconcile when the promise resolves. A
        // Promise may be shared by selectors or stores, so Promise identity is
        // not a safe owner for this data. Only needed for native-promise
        // selectors — SuspendAndWaitForResolveError re-evaluates via
        // initSelector instead.
        if (isPromiseLike(result)) {
            // Build the tracking set from sync deps discovered so far. Late
            // `get` calls (after await) will add to this set dynamically.
            evalCtx.asyncDeps = new Set<State>(updatedDeps)
            // Transaction evaluators own a private dependency graph and never
            // publish a committed cold cache, so revision snapshots would be
            // both unused and an avoidable allocation on that path.
            if (!runtime && !tracksReverseEdges) {
                evalCtx.asyncDependencyRevisions = new Map<State, number>()
                for (const dependency of updatedDeps) {
                    evalCtx.asyncDependencyRevisions.set(
                        dependency,
                        getStateRevision(dependency, data),
                    )
                }
            }
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
    runtime?: SelectorEvaluationRuntime,
    selectorGraphActive?: boolean,
) => {
    const tracksCommittedGraph =
        !runtime &&
        (selectorGraphActive ?? data.selectorGraphActive.has(selector))
    if (value instanceof SuspendAndWaitForResolveError) {
        if (runtime) {
            runtime.abortControllers.delete(selector)
            return value.promise
        }
        // The selector was suspended — it threw before completing, so no
        // meaningful async work was started with the current signal. Clear
        // the AbortController so that when the dependency resolves and
        // propagation re-evaluates this selector, it won't spuriously
        // abort the signal.
        data.abortControllers.delete(selector)
        const promise = value.promise
        const evaluationContext = data.latestEvalContext.get(selector)
        promise.then(() => {
            // Dependency presence alone is not an evaluation identity: a stale
            // late `get` or a newer evaluation can recreate the selector's graph.
            // Only the context that installed this handler may retry/commit.
            if (
                !evaluationContext ||
                evaluationContext.revoked ||
                data.latestEvalContext.get(selector) !== evaluationContext
            ) return
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
        if (!tracksCommittedGraph) {
            const dependencies = data.stateDependencies.get(selector)
            if (dependencies)
                recordColdSelectorCache(selector, dependencies, data)
        }
        return promise
    } else if (isPromiseLike(value)) {
        if (runtime) {
            const evaluationContext = runtime.latestEvalContext.get(selector)
            value.then(resolved => {
                const evalDeps = evaluationContext?.asyncDeps
                if (evaluationContext) evaluationContext.asyncDeps = undefined
                if (
                    !evaluationContext ||
                    evaluationContext.revoked ||
                    runtime.latestEvalContext.get(selector) !== evaluationContext
                ) return

                // Reconcile carried async dependencies in the private graph.
                if (evalDeps) {
                    const currentDeps = runtime.stateDependencies.get(selector)
                    if (currentDeps) {
                        for (const dep of currentDeps) {
                            if (!evalDeps.has(dep)) currentDeps.delete(dep)
                        }
                    }
                }
                validateResolvedValue(selector, resolved, data)
            }).catch(() => {
                if (evaluationContext) evaluationContext.asyncDeps = undefined
            })
            return value
        }
        // When a promise is returned when initializing a selector we suspend,
        // then we retry when the promise resolves.
        const evaluationContext = data.latestEvalContext.get(selector)
        value.then(resolved => {
            // Take and clear this evaluation's dependency set up front. The
            // latest context remains cached after resolution, so retaining the
            // Set there would keep its dependency states alive unnecessarily.
            const evalDeps = evaluationContext?.asyncDeps
            const evalDependencyRevisions =
                evaluationContext?.asyncDependencyRevisions
            if (evaluationContext) evaluationContext.asyncDeps = undefined
            if (evaluationContext)
                evaluationContext.asyncDependencyRevisions = undefined

            // A graph entry can be recreated after this Promise was superseded;
            // use per-evaluation identity as the primary stale-result guard.
            if (
                !evaluationContext ||
                evaluationContext.revoked ||
                data.latestEvalContext.get(selector) !== evaluationContext
            ) return
            // Guard: selector was cleaned up by unsubscribe GC
            if (!data.stateDependencies.has(selector)) return
            // Guard against stale promise
            if (data.values.has(selector) && data.values.get(selector) !== value) return

            // Reconcile deps: remove any that were carried forward from a
            // previous evaluation but not read in this one.
            if (evalDeps) {
                const currentDeps = data.stateDependencies.get(selector)
                if (currentDeps) {
                    const tracksReverseEdges =
                        data.selectorGraphActive.has(selector)
                    const selectorIsLive = isLive(selector, data)
                    let graphChangeNoted = false
                    for (const dep of currentDeps) {
                        if (!evalDeps.has(dep)) {
                            if (tracksReverseEdges && !graphChangeNoted) {
                                noteDependencyGraphChanged(selector, data)
                                graphChangeNoted = true
                            }
                            currentDeps.delete(dep)
                            if (tracksReverseEdges) {
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
            }

            // Async validation can't throw to a caller; on failure it's
            // reported and we clean up so the invalid value never commits.
            // Consistent with the atom async paths.
            if (!validateResolvedValue(selector, resolved, data)) {
                cleanUpRejectedPromise(selector, data, value as Promise<any>)
                return
            }
            // @ts-ignore
            setValueInData(selector, resolved, data)
            const resolvedDependencies = data.stateDependencies.get(selector)
            if (
                resolvedDependencies &&
                !data.selectorGraphActive.has(selector)
            ) {
                const current = recordColdSelectorCache(
                    selector,
                    resolvedDependencies,
                    data,
                    evalDependencyRevisions,
                )
                if (current) markColdSelectorCacheValidated(selector, data)
            }
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
            if (evaluationContext) evaluationContext.asyncDeps = undefined
            if (evaluationContext)
                evaluationContext.asyncDependencyRevisions = undefined
            cleanUpRejectedPromise(selector, data, value as Promise<any>)
        })
        if (!tracksCommittedGraph) {
            const dependencies = data.stateDependencies.get(selector)
            if (dependencies)
                recordColdSelectorCache(selector, dependencies, data)
        }
        return value
    } else {
        // Sync result — mark as known-sync so subsequent evaluations skip
        // AbortController allocation on the hot path. Only meaningful for
        // selectors that read options (arity >= 2); arity-<2 selectors bypass
        // the abortControllers path entirely, so don't pollute the map.
        if ((selector.get as (...args: any[]) => any).length >= 2) {
            ;(runtime?.abortControllers ?? data.abortControllers).set(
                selector,
                false,
            )
        }
        const validated = validateSchema(selector, value, data)
        // Transaction selector evaluation uses private dependency bookkeeping.
        // It must not refresh metadata for the committed value/graph.
        if (!runtime && !tracksCommittedGraph) {
            const dependencies = data.stateDependencies.get(selector)
            if (dependencies) {
                recordColdSelectorCache(selector, dependencies, data)
            }
        }
        return validated
    }
}

// Keep the committed call shape monomorphic: passing unused overlay/runtime
// arguments measurably deoptimizes Bun's ordinary selector hot path. This is a
// thin boundary only; both committed and transactional reads still delegate to
// the same evaluator and result handler below.
const evaluateCommittedSelectorValue = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<Selector>,
    selectorGraphActive: boolean,
) => {
    let value
    try {
        value = evaluateSelector(
            selector,
            data,
            initializedAtomsSet,
            circularDependencySet,
            selectorGraphActive,
        )
    } catch (error) {
        if (error instanceof SelectorEvaluationError) error.track(selector)
        throw error
    }
    return handleSelectorResult(
        value,
        selector,
        data,
        undefined,
        selectorGraphActive,
    )
}

export const initSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<Selector> = data.circularDepSet,
    selectorGraphActiveOverride?: boolean,
): boolean => {
    const selectorGraphActive =
        selectorGraphActiveOverride ?? data.selectorGraphActive.has(selector)
    const existingValue = data.values.get(selector)
    const updatedValue = evaluateCommittedSelectorValue(
        selector,
        data,
        initializedAtomsSet,
        circularDependencySet,
        selectorGraphActive,
    )

    // Promises should use reference equality — deep equal treats all
    // promises as structurally identical (both have zero own keys).
    const areEqual = isPromiseLike(existingValue) || isPromiseLike(updatedValue)
        ? existingValue === updatedValue
        : selector.equal(existingValue as V, updatedValue as V)

    if (areEqual) {
        if (!selectorGraphActive) {
            markColdSelectorCacheValidated(selector, data)
        }
        return false
    } else {
        setValueInData<V>(selector, updatedValue as V, data)
        if (!selectorGraphActive) {
            markColdSelectorCacheValidated(selector, data)
        }
        return true
    }
}

/** Evaluate through the store selector boundary, optionally using a read
 * overlay and private bookkeeping for transactional reads. */
export const evaluateSelectorValue = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    readOverlay?: GetValue,
    circularDependencySet: WeakSet<Selector> = data.circularDepSet,
    runtime?: SelectorEvaluationRuntime,
) => {
    const selectorGraphActive =
        !runtime && data.selectorGraphActive.has(selector)
    let value
    try {
        value = evaluateSelector(
            selector,
            data,
            initializedAtomsSet,
            circularDependencySet,
            selectorGraphActive,
            undefined,
            readOverlay,
            runtime,
        )
    } catch (error) {
        if (error instanceof SelectorEvaluationError) error.track(selector)
        throw error
    }
    return handleSelectorResult(value, selector, data, runtime)
}
