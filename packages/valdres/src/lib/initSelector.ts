import { SchemaValidationError } from "../errors/SchemaValidationError"
import { SelectorCircularDependencyError } from "../errors/SelectorCircularDependencyError"
import { SelectorEvaluationError } from "../errors/SelectorEvaluationError"
import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { GetValue } from "../types/GetValue"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { SelectorEvaluationContext, StoreData } from "../types/StoreData"
import { isPromiseLike } from "../utils/isPromiseLike"
import { isSelector } from "../utils/isSelector"
import {
    SuspendAndWaitForResolveError,
    cleanUpRejectedPromise,
} from "./asyncDependencyTracking"
import { renderDirtyFamilyIndex } from "./atomFamilyIndex"
import { getState } from "./getState"
import {
    type EvaluationOutcome,
    acquireEvaluationOutcome,
    installEvaluationDeps,
    installEvaluationDepsLiveOnly,
    installLateDependency,
    markSelectorGraphActive,
    reconcileAsyncDeps,
    releaseEvaluationOutcome,
    rollbackSelectorActivation,
    settleLateDependency,
} from "./graph"
import { hasCommittedValue } from "./hasCommittedValue"
import { createGuardedScalarCommit, runCommitPlan } from "./commitEngine"
import { createCommitErrors } from "./commitErrors"
import { SETTLE_DEFAULT } from "./commitIntents"
import { activeCommitBoundary, commitEndRegistry } from "./onCommitEnd"
import {
    settleCommit,
    settleAsyncSelectorCommit,
} from "./propagateUpdatedAtoms"
import { reportAsyncSchemaError } from "./reportAsyncSchemaError"
import { setValueInData } from "./setValueInData"
import {
    getStateRevision,
    markColdSelectorCacheValidated,
    recordColdSelectorCache,
    trackStateRevision,
} from "./stateRevisions"
import {
    createStoreDisposedError,
    isStoreDisposed,
    trackAbortController,
    untrackAbortController,
} from "./storeLifecycle"
import { validateResolvedValue } from "./validateResolvedValue"
import { validateSchema } from "./validateSchema"
import { recordSelectorEvaluation } from "./architectureInstrumentation"
import { IS_PROD } from "./IS_PROD"
import {
    createCommitPlan,
    NO_ON_SETS,
    NO_SETTLEMENT,
    selectorSettlement,
} from "./commitPlans"

export { isSuspendError } from "./asyncDependencyTracking"

const admitNativeSelectorSettlement = (
    selector: Selector,
    _resolved: unknown,
    promise: Promise<any>,
    data: StoreData,
    evaluationContext: SelectorEvaluationContext | undefined,
    _dependencyRevisions: Map<State, number> | undefined,
): boolean => {
    const currentValue = data.values.get(selector)
    return (
        !isStoreDisposed(data) &&
        !!evaluationContext &&
        !evaluationContext.revoked &&
        data.latestEvalContext.get(selector) === evaluationContext &&
        data.stateDependencies.has(selector) &&
        // Either this promise is still the committed value, or nothing is
        // committed at all — a settled value from elsewhere supersedes us.
        (currentValue === promise ||
            !hasCommittedValue(selector, data, currentValue))
    )
}

const applyNativeSelectorSettlement = (
    selector: Selector,
    resolved: unknown,
    _promise: Promise<any>,
    data: StoreData,
    _evaluationContext: SelectorEvaluationContext | undefined,
    dependencyRevisions: Map<State, number> | undefined,
) => {
    setValueInData(selector, resolved, data)
    const resolvedDependencies = data.stateDependencies.get(selector)
    if (resolvedDependencies && !data.selectorGraphActive.has(selector)) {
        const current = recordColdSelectorCache(
            selector,
            resolvedDependencies,
            data,
            dependencyRevisions,
        )
        if (current) markColdSelectorCacheValidated(selector, data)
    }
}

const commitNativeSelectorSettlement = createGuardedScalarCommit(
    admitNativeSelectorSettlement,
    applyNativeSelectorSettlement,
)

const admitNativeSelectorCleanup = (
    selector: Selector,
    _resolved: unknown,
    promise: Promise<any>,
    data: StoreData,
    _evaluationContext: SelectorEvaluationContext | undefined,
    _dependencyRevisions: Map<State, number> | undefined,
): boolean => {
    const currentValue = data.values.get(selector)
    return (
        !isStoreDisposed(data) &&
        (currentValue === promise ||
            !hasCommittedValue(selector, data, currentValue))
    )
}

const applyNativeSelectorCleanup = (
    selector: Selector,
    _resolved: unknown,
    promise: Promise<any>,
    data: StoreData,
    _evaluationContext: SelectorEvaluationContext | undefined,
    _dependencyRevisions: Map<State, number> | undefined,
) => cleanUpRejectedPromise(selector, data, promise)

/**
 * The selector's public options object and its internal evaluation identity are
 * the same allocation. Controller/lifecycle state stays in private fields, so
 * making signals evaluation-local doesn't add a second object to the ordinary
 * selector hot path. The controller itself remains lazy.
 */
class SelectorEvaluation implements SelectorEvaluationContext {
    readonly #selector: Selector
    readonly #data: StoreData
    readonly #runtimeAbortControllers?: Map<Selector, AbortController>
    #revoked = false
    #preserveSignalOnRevoke = false
    #abortController?: AbortController

    declare asyncDeps?: Set<State>
    declare asyncDependencyRevisions?: Map<State, number>

    constructor(
        selector: Selector,
        data: StoreData,
        runtimeAbortControllers?: Map<Selector, AbortController>,
    ) {
        this.#selector = selector
        this.#data = data
        this.#runtimeAbortControllers = runtimeAbortControllers
    }

    get storeId() {
        return this.#data.id
    }

    get revoked() {
        return this.#revoked
    }

    get signal() {
        let controller = this.#abortController
        if (!controller) {
            controller = new AbortController()
            this.#abortController = controller
            if (this.#revoked) {
                if (!this.#preserveSignalOnRevoke) controller.abort()
            } else if (!this.#preserveSignalOnRevoke) {
                this.#abortControllers.set(this.#selector, controller)
                // Transaction overlays own their dependency graph, but the
                // backing store still owns cancellation of async work. Track
                // the lazy controller directly so a completed transaction does
                // not need to stay retained merely to make dispose exhaustive.
                trackAbortController(this.#data, controller)
            }
        }
        return controller.signal
    }

    revoke() {
        this.#revoked = true
        if (!this.#preserveSignalOnRevoke && this.#abortController) {
            this.#abortController.abort()
            this.#abortControllers.delete(this.#selector)
            untrackAbortController(this.#data, this.#abortController)
        }
    }

    preserveSignal() {
        this.#preserveSignalOnRevoke = true
        if (this.#abortController) {
            this.#abortControllers.delete(this.#selector)
            untrackAbortController(this.#data, this.#abortController)
        }
    }

    get #abortControllers() {
        return this.#runtimeAbortControllers ?? this.#data.abortControllers
    }
}

export const initFreshActiveSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<Selector>,
): V => {
    markSelectorGraphActive(selector, data)
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
        rollbackSelectorActivation(selector, data)
        throw error
    }
}

const rollbackFreshSelectorActivations = (
    selectors: Selector | Selector[] | undefined,
    data: StoreData,
) => {
    if (!selectors) return
    if (!Array.isArray(selectors)) {
        rollbackSelectorActivation(selectors, data)
        return
    }
    for (let i = selectors.length - 1; i >= 0; i--) {
        rollbackSelectorActivation(selectors[i], data)
    }
}

/**
 * Handle a deferred `get` call — one that runs after the synchronous
 * evaluation of the selector has already completed (e.g. inside a
 * setTimeout or after an await). Registers the dependency through the graph
 * runtime, reads the value, and settles (promotes/mounts) ONLY a genuinely
 * new edge — settling an existing one would double-count its liveness.
 * The read stays sandwiched between the two graph calls: a cold selector is
 * validated/read before its dependency graph is promoted.
 */
const lateGet = (state: State, selector: Selector, data: StoreData) => {
    const added = installLateDependency(selector, state, data)
    // Atoms lazily initialized here are first-time accesses — no other
    // selector depends on them yet, so propagation is unnecessary.
    const lateInitSet = new Set<Atom>()
    try {
        return getState(state, data, lateInitSet)
    } finally {
        if (added) settleLateDependency(selector, state, data)
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

/** Selector bookkeeping owned by a read overlay rather than the committed
 * store. Transactions keep this state local so an aborted speculative read
 * cannot rewrite the store's dependency graph or publish an async result. */
export type SelectorEvaluationRuntime = {
    abortControllers: Map<Selector, AbortController>
    latestEvalContext: Map<Selector, SelectorEvaluationContext>
    stateDependencies: Map<Selector, Set<State>>
    readOverlayActive: boolean
}

/**
 * Dedicated evaluator for the dominant live-only store shape. Before a store
 * creates its first cold cache, every materialized selector belongs to the
 * live reverse graph, so none of the cold/live mode branches are needed.
 * Keeping this code shape separate lets JavaScriptCore tier it like the
 * pre-cold-cache evaluator instead of compiling the larger mixed-mode path.
 */
const evaluateLiveOnlySelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<Selector>,
    outcome: EvaluationOutcome,
) => {
    if (!IS_PROD && data.architectureInstrumentation)
        recordSelectorEvaluation(data)
    const currentDependencies = data.stateDependencies.get(selector)
    const updatedDeps = new Set<State<any>>()
    let depsChanged = false
    let evaluationComplete = false
    let activatedDuringEvaluation: Selector | Selector[] | undefined

    const prevCtx = data.latestEvalContext.get(selector)
    if (prevCtx) prevCtx.revoke()
    const evalCtx = new SelectorEvaluation(selector, data)
    data.latestEvalContext.set(selector, evalCtx)

    if (circularDependencySet.has(selector)) {
        throw new SelectorCircularDependencyError()
    }
    circularDependencySet.add(selector)

    try {
        let result
        try {
            result = selector.get((state: any) => {
                if (evaluationComplete) {
                    if (!evalCtx.revoked && evalCtx.asyncDeps) {
                        evalCtx.asyncDeps.add(state)
                    }
                    if (evalCtx.revoked) {
                        return getState(state, data, new Set<Atom>())
                    }
                    return lateGet(state, selector, data)
                }

                let value
                if (data.values.has(state)) {
                    // A selector reading a family observes its membership here,
                    // so a snapshot deferred by a membership write materializes
                    // before the selector body sees it.
                    value =
                        data.dirtyFamilyIndexes !== undefined &&
                        data.dirtyFamilyIndexes.has(
                            state as AtomFamily<any, any>,
                        )
                            ? renderDirtyFamilyIndex(
                                  state as AtomFamily<any, any>,
                                  data,
                              )
                            : data.values.get(state)
                } else if (isSelector(state)) {
                    const wasMaterialized = data.stateDependencies.has(state)
                    value = initFreshActiveSelector(
                        state,
                        data,
                        initializedAtomsSet,
                        circularDependencySet,
                    )
                    if (!wasMaterialized) {
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
                    }
                } else {
                    value = getState(
                        state,
                        data,
                        initializedAtomsSet,
                        circularDependencySet,
                    )
                }
                updatedDeps.add(state)
                if (
                    !depsChanged &&
                    (!currentDependencies || !currentDependencies.has(state))
                ) {
                    depsChanged = true
                }
                if (isPromiseLike(value)) {
                    throw new SuspendAndWaitForResolveError(value)
                }
                return value
            }, evalCtx)
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
        // Probe the user-visible `then` exactly once: a getter there can run
        // a deferred `get` (installing edges through lateGet), so no second
        // probe may happen between capture and the dispatcher's install —
        // that window would let the install overwrite the late edge's
        // forward set and strand its reverse edge.
        const isPromiseResult = isPromiseLike(result)
        const isAsyncResult =
            result instanceof SuspendAndWaitForResolveError || isPromiseResult

        if (
            !isAsyncResult &&
            !depsChanged &&
            currentDependencies &&
            currentDependencies.size !== updatedDeps.size
        ) {
            depsChanged = true
        }

        outcome.deps = updatedDeps
        outcome.prevDeps = currentDependencies
        outcome.depsChanged = depsChanged
        outcome.isAsync = isAsyncResult
        outcome.needsInstall = depsChanged || !currentDependencies

        if (isPromiseResult) {
            evalCtx.asyncDeps = new Set<State>(updatedDeps)
        }
        return result
    } finally {
        circularDependencySet.delete(selector)
    }
}

export const evaluateSelector = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<Selector> = data.circularDepSet,
    selectorGraphActive: boolean = false,
    outcome: EvaluationOutcome,
    readOverlay?: GetValue,
    runtime?: SelectorEvaluationRuntime,
) => {
    if (!IS_PROD && data.architectureInstrumentation)
        recordSelectorEvaluation(data)
    const stateDependencies =
        runtime?.stateDependencies ?? data.stateDependencies
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
    const latestEvalContext =
        runtime?.latestEvalContext ?? data.latestEvalContext
    const prevCtx = latestEvalContext.get(selector)
    if (prevCtx) prevCtx.revoke()
    const evalCtx = new SelectorEvaluation(
        selector,
        data,
        runtime?.abortControllers,
    )
    latestEvalContext.set(selector, evalCtx)

    if (circularDependencySet.has(selector)) {
        throw new SelectorCircularDependencyError()
    }
    circularDependencySet.add(selector)

    try {
        let result
        try {
            result = selector.get((state: any) => {
                // Deferred get calls (setTimeout, after await) use late binding
                if (evaluationComplete) {
                    if (isStoreDisposed(data)) {
                        throw createStoreDisposedError(data)
                    }
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
                        // validate. Preserve the original WeakMap has/get path,
                        // plus the family observation boundary (see above).
                        value =
                            data.dirtyFamilyIndexes !== undefined &&
                            data.dirtyFamilyIndexes.has(
                                state as AtomFamily<any, any>,
                            )
                                ? renderDirtyFamilyIndex(
                                      state as AtomFamily<any, any>,
                                      data,
                                  )
                                : data.values.get(state)
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
                if (
                    !depsChanged &&
                    (!currentDependencies || !currentDependencies.has(state))
                ) {
                    depsChanged = true
                }
                if (isPromiseLike(value))
                    throw new SuspendAndWaitForResolveError(value)

                return value
            }, evalCtx)
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

        // Probe the user-visible `then` exactly once — see the identical note
        // in evaluateLiveOnlySelector: a second probe before the dispatcher
        // installs would let a `then`-getter's deferred `get` be overwritten.
        const isPromiseResult = isPromiseLike(result)
        const isAsyncResult =
            result instanceof SuspendAndWaitForResolveError || isPromiseResult

        // For sync selectors, check if dep count changed (handles removed deps).
        // For async selectors, skip — the dep count is incomplete until the
        // promise resolves.
        if (
            !isAsyncResult &&
            !depsChanged &&
            currentDependencies &&
            currentDependencies.size !== updatedDeps.size
        ) {
            depsChanged = true
        }

        // Hand the discovered dep set to the dispatcher, which installs it
        // through the graph runtime (overlay or committed) after this
        // evaluator returns. The evaluator itself no longer writes any graph
        // table.
        outcome.deps = updatedDeps
        outcome.prevDeps = currentDependencies
        outcome.depsChanged = depsChanged
        outcome.isAsync = isAsyncResult
        outcome.needsInstall = depsChanged || !currentDependencies

        // Store the tracking set on this evaluation's identity so
        // handleSelectorResult can reconcile when the promise resolves. A
        // Promise may be shared by selectors or stores, so Promise identity is
        // not a safe owner for this data. Only needed for native-promise
        // selectors — SuspendAndWaitForResolveError re-evaluates via
        // initSelector instead.
        if (isPromiseResult) {
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
            const evaluationContext = runtime.latestEvalContext.get(selector)
            if (evaluationContext) {
                evaluationContext.preserveSignal()
            } else {
                runtime.abortControllers.delete(selector)
            }
            return value.promise
        }
        // The selector was suspended — it threw before completing, so no
        // meaningful async work was started with the current signal. Clear
        // the AbortController so that when the dependency resolves and
        // propagation re-evaluates this selector, it won't spuriously
        // abort the signal.
        const promise = value.promise
        const evaluationContext = data.latestEvalContext.get(selector)
        if (evaluationContext) {
            evaluationContext.preserveSignal()
        } else {
            untrackAbortController(data, data.abortControllers.get(selector))
            data.abortControllers.delete(selector)
        }
        promise
            .then(() => {
                if (isStoreDisposed(data)) return
                // Dependency presence alone is not an evaluation identity: a stale
                // late `get` or a newer evaluation can recreate the selector's graph.
                // Only the context that installed this handler may retry/commit.
                if (
                    !evaluationContext ||
                    evaluationContext.revoked ||
                    data.latestEvalContext.get(selector) !== evaluationContext
                )
                    return
                // Guard against stale promise — if the selector's value has been
                // replaced with a different value, this resolution is outdated.
                // If the value was deleted (e.g. moved to expired), still proceed.
                // If deps were cleaned up (unsubscribe GC), bail entirely.
                if (!data.stateDependencies.has(selector)) return
                if (
                    data.values.has(selector) &&
                    data.values.get(selector) !== promise
                )
                    return
                const initializedAtomsSet = new Set<Atom>()
                const res = initSelector(selector, data, initializedAtomsSet)
                if (initializedAtomsSet.size > 0) {
                    settleCommit(
                        [...initializedAtomsSet],
                        data,
                        undefined,
                        "async-set",
                        SETTLE_DEFAULT,
                    )
                }
                return res
            })
            .catch(err => {
                if (isStoreDisposed(data)) return
                cleanUpRejectedPromise(selector, data, promise)
                // Report schema validation failures (thrown from the sync
                // re-evaluation inside initSelector) instead of swallowing them,
                // consistent with the native-promise path below.
                if (err instanceof SchemaValidationError)
                    reportAsyncSchemaError(err)
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
            value
                .then(resolved => {
                    if (isStoreDisposed(data)) return
                    const evalDeps = evaluationContext?.asyncDeps
                    if (evaluationContext)
                        evaluationContext.asyncDeps = undefined
                    if (
                        !evaluationContext ||
                        evaluationContext.revoked ||
                        runtime.latestEvalContext.get(selector) !==
                            evaluationContext
                    )
                        return

                    // Reconcile carried async dependencies in the private graph.
                    if (evalDeps) {
                        const currentDeps =
                            runtime.stateDependencies.get(selector)
                        if (currentDeps) {
                            for (const dep of currentDeps) {
                                if (!evalDeps.has(dep)) currentDeps.delete(dep)
                            }
                        }
                    }
                    validateResolvedValue(selector, resolved, data)
                })
                .catch(() => {
                    if (isStoreDisposed(data)) return
                    if (evaluationContext)
                        evaluationContext.asyncDeps = undefined
                })
            return value
        }
        // When a promise is returned when initializing a selector we suspend,
        // then we retry when the promise resolves.
        const evaluationContext = data.latestEvalContext.get(selector)
        value.then(
            resolved => {
                if (isStoreDisposed(data)) return
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
                )
                    return
                // Guard: selector was cleaned up by unsubscribe GC
                if (!data.stateDependencies.has(selector)) return
                // Guard against stale promise
                if (
                    data.values.has(selector) &&
                    data.values.get(selector) !== value
                )
                    return

                // Reconcile deps: remove any that were carried forward from a
                // previous evaluation but not read in this one.
                if (evalDeps) {
                    reconcileAsyncDeps(selector, evalDeps, data)
                }

                // Async validation can't throw to a caller; on failure it's
                // reported and we clean up so the invalid value never commits.
                // Consistent with the atom async paths.
                if (!validateResolvedValue(selector, resolved, data)) {
                    runCommitPlan(
                        createCommitPlan(
                            data,
                            NO_SETTLEMENT,
                            NO_ON_SETS,
                            createCommitErrors(),
                            undefined,
                            undefined,
                            () =>
                                admitNativeSelectorCleanup(
                                    selector,
                                    resolved,
                                    value as Promise<any>,
                                    data,
                                    evaluationContext,
                                    evalDependencyRevisions,
                                ),
                            () =>
                                applyNativeSelectorCleanup(
                                    selector,
                                    resolved,
                                    value as Promise<any>,
                                    data,
                                    evaluationContext,
                                    evalDependencyRevisions,
                                ),
                        ),
                    )
                    return
                }
                const dependents = data.stateDependents.get(selector)
                const subs = data.subscriptions.get(selector)
                const hasSettlementObservers =
                    commitEndRegistry.count !== 0 ||
                    (subs?.size ?? 0) !== 0 ||
                    (dependents?.size ?? 0) !== 0
                if (!hasSettlementObservers) {
                    commitNativeSelectorSettlement(
                        selector,
                        resolved,
                        value as Promise<any>,
                        data,
                        evaluationContext,
                        evalDependencyRevisions,
                    )
                    return
                }
                runCommitPlan(
                    createCommitPlan(
                        data,
                        selectorSettlement(
                            data,
                            selector,
                            settleAsyncSelectorCommit,
                        ),
                        NO_ON_SETS,
                        createCommitErrors(),
                        "async-set",
                        undefined,
                        () =>
                            admitNativeSelectorSettlement(
                                selector,
                                resolved,
                                value as Promise<any>,
                                data,
                                evaluationContext,
                                evalDependencyRevisions,
                            ),
                        () =>
                            applyNativeSelectorSettlement(
                                selector,
                                resolved,
                                value as Promise<any>,
                                data,
                                evaluationContext,
                                evalDependencyRevisions,
                            ),
                        undefined,
                        undefined,
                        activeCommitBoundary(),
                    ),
                )
            },
            () => {
                if (evaluationContext) evaluationContext.asyncDeps = undefined
                if (evaluationContext)
                    evaluationContext.asyncDependencyRevisions = undefined
                runCommitPlan(
                    createCommitPlan(
                        data,
                        NO_SETTLEMENT,
                        NO_ON_SETS,
                        createCommitErrors(),
                        undefined,
                        undefined,
                        () =>
                            admitNativeSelectorCleanup(
                                selector,
                                undefined,
                                value as Promise<any>,
                                data,
                                evaluationContext,
                                undefined,
                            ),
                        () =>
                            applyNativeSelectorCleanup(
                                selector,
                                undefined,
                                value as Promise<any>,
                                data,
                                evaluationContext,
                                undefined,
                            ),
                    ),
                )
            },
        )
        if (!tracksCommittedGraph) {
            const dependencies = data.stateDependencies.get(selector)
            if (dependencies)
                recordColdSelectorCache(selector, dependencies, data)
        }
        return value
    } else {
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

/** Install a transaction overlay evaluation into the draft's private forward
 * map. The overlay graph tracks async dependencies and re-evaluations, but
 * deliberately has no committed reverse edges or liveness — it never touches
 * the committed graph tables, so it lives with the evaluator, not the graph
 * runtime. */
const installOverlayDeps = (
    selector: Selector,
    runtime: SelectorEvaluationRuntime,
    outcome: EvaluationOutcome,
) => {
    const updatedDeps = outcome.deps!
    const currentDependencies = outcome.prevDeps
    const updatedDependencies = outcome.isAsync
        ? new Set<State<any>>(updatedDeps)
        : updatedDeps
    if (outcome.isAsync && currentDependencies) {
        for (const dep of currentDependencies) {
            updatedDependencies.add(dep)
        }
    }
    runtime.stateDependencies.set(selector, updatedDependencies)
}

/** Out-of-line installer choice for the committed dispatcher. Uses the SAME
 * predicate value that selected the evaluator, so the twin evaluator and twin
 * installer can never diverge. Kept out of the dispatcher body so the
 * no-churn hot path stays small enough for V8 to inline. */
const installCommittedOutcome = (
    selector: Selector,
    data: StoreData,
    selectorGraphActive: boolean,
    liveOnly: boolean,
    outcome: EvaluationOutcome,
) => {
    if (liveOnly) {
        installEvaluationDepsLiveOnly(
            selector,
            data,
            outcome.deps!,
            outcome.prevDeps,
            outcome.isAsync,
        )
    } else {
        installEvaluationDeps(
            selector,
            data,
            outcome.deps!,
            outcome.prevDeps,
            selectorGraphActive,
            outcome.isAsync,
            undefined,
        )
    }
}

/** Cold path of the dispatcher's catch: keep the carrier release and error
 * tracking out of the hot body. Returns the error to rethrow. */
const releaseAfterEvaluationThrow = (
    selector: Selector,
    outcome: EvaluationOutcome,
    error: unknown,
): unknown => {
    // Release here rather than in a wrapping finally: the extra exception
    // scope measurably hurt V8's re-init hot path, and the installers run no
    // user code, so the throw paths end at the evaluator.
    releaseEvaluationOutcome(outcome)
    if (error instanceof SelectorEvaluationError) error.track(selector)
    return error
}

// Keep the committed call shape monomorphic: passing unused overlay/runtime
// arguments measurably deoptimizes Bun's ordinary selector hot path. This is a
// thin boundary only; both committed and transactional reads still delegate to
// the same evaluator and result handler below. The dispatcher — not the
// evaluator — commits discovered dependencies into the graph.
const evaluateCommittedSelectorValue = <V>(
    selector: Selector<V>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<Selector>,
    selectorGraphActive: boolean,
) => {
    const liveOnly = selectorGraphActive && !data.coldSelectorCachesEnabled
    const outcome = acquireEvaluationOutcome()
    let value
    try {
        value = liveOnly
            ? evaluateLiveOnlySelector(
                  selector,
                  data,
                  initializedAtomsSet,
                  circularDependencySet,
                  outcome,
              )
            : evaluateSelector(
                  selector,
                  data,
                  initializedAtomsSet,
                  circularDependencySet,
                  selectorGraphActive,
                  outcome,
              )
    } catch (error) {
        throw releaseAfterEvaluationThrow(selector, outcome, error)
    }
    if (outcome.needsInstall) {
        installCommittedOutcome(
            selector,
            data,
            selectorGraphActive,
            liveOnly,
            outcome,
        )
    }
    releaseEvaluationOutcome(outcome)
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

    // Nothing committed means nothing can be equal, so skipping the write would
    // leave the selector permanently unmemoized: every cache hit downstream
    // keys off `values.has`, so each later read re-runs the body — including
    // each repeated `get(child)` inside ONE parent evaluation, which turns a
    // shared leaf in a recursive traversal into O(reads x full re-eval).
    //
    // This comparison is the hot one, so the value already in hand carries the
    // presence question: hasCommittedValue probes the map only when there is an
    // `undefined` to disambiguate.
    const hasExistingValue = hasCommittedValue(selector, data, existingValue)

    // Gate `equal` on presence rather than filtering its result afterwards (see
    // hasCommittedValue): with nothing committed the answer is "not equal" by
    // definition, so the call is skipped rather than repaired, and no
    // comparator is ever shown the absent sentinel.
    // Promises use reference equality — deep equal treats all promises as
    // structurally identical (both have zero own keys).
    const areEqual =
        hasExistingValue &&
        (isPromiseLike(existingValue) || isPromiseLike(updatedValue)
            ? existingValue === updatedValue
            : selector.equal(existingValue as V, updatedValue as V))

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
    const outcome = acquireEvaluationOutcome()
    let value
    try {
        value = evaluateSelector(
            selector,
            data,
            initializedAtomsSet,
            circularDependencySet,
            selectorGraphActive,
            outcome,
            readOverlay,
            runtime,
        )
    } catch (error) {
        throw releaseAfterEvaluationThrow(selector, outcome, error)
    }
    if (outcome.needsInstall) {
        if (runtime) {
            installOverlayDeps(selector, runtime, outcome)
        } else {
            installCommittedOutcome(
                selector,
                data,
                selectorGraphActive,
                false,
                outcome,
            )
        }
    }
    releaseEvaluationOutcome(outcome)
    return handleSelectorResult(value, selector, data, runtime)
}
