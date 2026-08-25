import type { DepsChange } from "../../types/DepsChange"
import type { Selector } from "../../types/Selector"
import type { State } from "../../types/State"
import type { StoreData } from "../../types/StoreData"
import { isSelector } from "../../utils/isSelector"
import {
    endColdValidationPassForExternalChange,
    invalidateColdSelectorCache,
} from "../stateRevisions"
import { DISPOSED_STORE_PENDING } from "../storeLifecycle"
import { cleanupOrphanedDeps } from "./cleanupOrphanedDeps"
import {
    addStateDependent,
    removeStateDependent,
} from "./inheritedDependencyBranches"
import {
    activateSelectorGraph,
    isLive,
    mountTransitiveDeps,
    noteDependencyAdded,
    onLiveDependencyAdded,
    onLiveDependencyRemoved,
    unmountOrphanedDeps,
} from "./mountAtom"
import {
    noteDependencyGraphChanged,
    noteDependencyMaterialized,
} from "./noteDependencyGraphChanged"
import { dropGraphWorkspaces } from "./workspace"

/**
 * Graph-runtime installers: the write API evaluation and settlement code use
 * to commit discovered dependencies into the graph tables. Evaluators never
 * mutate graph state themselves — they fill an EvaluationOutcome and their
 * dispatcher hands it here. Immediately after an install the edge TOPOLOGY
 * (symmetric forward/reverse edges, order, scope branches) is consistent;
 * liveness and mounts may still be pending until the caller applies the
 * dependency diff (`applyLiveDependencyDiff`) or the owning liveness pass
 * reconciles — see graph/index.ts for the full phase model.
 */

/**
 * Commit a full dependency-set replacement discovered by one evaluation of
 * `selector` against the committed store. Verbatim semantics of the historical
 * in-evaluator install: version/order notes, liveness-pass seeding, async
 * merge-forward, add/remove edge diff, then the forward-set write — in that
 * order. Call only when the dep set actually changed (`outcome.needsInstall`).
 */
export const installEvaluationDeps = (
    selector: Selector,
    data: StoreData,
    updatedDeps: Set<State>,
    currentDependencies: Set<State> | undefined,
    tracksReverseEdges: boolean,
    isAsyncResult: boolean,
    depsChangeOut?: DepsChange,
): void => {
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
    if (tracksReverseEdges && data.livenessPassActive && currentDependencies) {
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
    // in (below) without mutating `updatedDeps`, which the evaluator still
    // reads as the promise-tracking seed (`asyncDeps`).
    const updatedDependencies = isAsyncResult
        ? new Set<State>(updatedDeps)
        : updatedDeps
    // For async selectors, retain all previous deps so they aren't
    // prematurely removed (and unmounted) before the continuation runs.
    // Stale deps are cleaned up when the promise resolves (see
    // reconcileAsyncDeps).
    if (isAsyncResult && currentDependencies) {
        for (const dep of currentDependencies) {
            updatedDependencies.add(dep)
        }
    }
    // First materialization: user code probed between capture and install
    // (e.g. a `then` accessor running a deferred `get`) may have created a
    // forward set through installLateDependency. Overwriting it would strand
    // its reverse edges — merge instead. The edge loop below is idempotent
    // for already-installed members. Re-evals need no merge: their late adds
    // land in `currentDependencies` itself and the removal diff below tears
    // them down symmetrically.
    if (!currentDependencies) {
        const interval = data.stateDependencies.get(selector)
        if (interval) {
            for (const dep of interval) {
                updatedDependencies.add(dep)
            }
        }
    }
    const prev = currentDependencies ?? new Set<State>()
    for (const state of updatedDependencies) {
        if (!prev.has(state)) {
            if (tracksReverseEdges) {
                addStateDependent(state, selector, data)
                // New edge: propagate the mount-closure marker up so the
                // mount/unmount walk-skip stays free of false negatives.
                noteDependencyAdded(selector, state, data)
                // A newly-read selector may itself have been only cold-
                // cached. Promote its closure before liveness bookkeeping
                // treats it as a live dependency. Stores that have never
                // built a cold cache have nothing to promote; keep that
                // dominant live-only path to one scalar branch rather
                // than a helper call plus a state-shape check per edge.
                if (data.coldSelectorCachesEnabled) {
                    activateSelectorGraph(state, data)
                }
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
                    removeStateDependent(state, selector, data)
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

/**
 * Twin of `installEvaluationDeps` for the dominant live-only store shape
 * (see evaluateLiveOnlySelector): reverse edges always tracked, no cold
 * caches to promote, no propagation-loop diff to mirror. Kept as a second
 * monomorphic entry so the pre-cold-cache path pays no per-edge mode branches.
 *
 * The semantic core is identical, and three files hold it that way — reach for
 * whichever matches the line you are changing:
 *   - `runtime.test.ts` (below, "installer twin parity") diffs the two
 *     installers directly on hand-built dependency-set transitions.
 *   - `selectorEvaluatorTwinFuzz.test.ts` drives both through the public API
 *     and compares edges, liveness counts and mount transitions per op.
 *   - `livenessCyclicFuzz.test.ts` owns the two cycle-gated liveness arms
 *     below (`livenessLazyArmed`, `livenessRemovalArmed`); the twin fuzz
 *     reaches them too rarely to guard them.
 */
export const installEvaluationDepsLiveOnly = (
    selector: Selector,
    data: StoreData,
    updatedDeps: Set<State>,
    currentDependencies: Set<State> | undefined,
    isAsyncResult: boolean,
): void => {
    noteDependencyGraphChanged(selector, data)
    if (data.livenessPassActive && currentDependencies) {
        ;(data.livenessSeeds ??= new Set<State>()).add(selector)
        data.livenessLazyArmed = true
    }
    const updatedDependencies = isAsyncResult
        ? new Set<State>(updatedDeps)
        : updatedDeps
    if (isAsyncResult && currentDependencies) {
        for (const dep of currentDependencies) {
            updatedDependencies.add(dep)
        }
    }
    // See installEvaluationDeps: merge a forward set created by a deferred
    // `get` in the capture-to-install window rather than overwriting it.
    if (!currentDependencies) {
        const interval = data.stateDependencies.get(selector)
        if (interval) {
            for (const dep of interval) {
                updatedDependencies.add(dep)
            }
        }
    }
    const prev = currentDependencies ?? new Set<State>()
    for (const state of updatedDependencies) {
        if (!prev.has(state)) {
            addStateDependent(state, selector, data)
            noteDependencyAdded(selector, state, data)
        }
    }
    if (!isAsyncResult) {
        for (const state of prev) {
            if (!updatedDependencies.has(state)) {
                removeStateDependent(state, selector, data)
                if (data.livenessPassActive && isSelector(state)) {
                    ;(data.livenessSeeds ??= new Set<State>()).add(state)
                    data.livenessRemovalArmed = true
                }
            }
        }
    }
    data.stateDependencies.set(selector, updatedDependencies)
}

/**
 * Register one dependency discovered by a deferred `get` (after an await or
 * timeout) — the pre-read half. Returns whether the edge is genuinely new;
 * the caller reads the dependency's value in between and MUST gate
 * `settleLateDependency` on that result: settling an existing edge would
 * double-increment liveDependentCount and remount an already-mounted dep.
 */
export const installLateDependency = (
    selector: Selector,
    state: State,
    data: StoreData,
): boolean => {
    let deps = data.stateDependencies.get(selector)
    if (!deps) {
        deps = new Set()
        data.stateDependencies.set(selector, deps)
    }
    const isNewDep = !deps.has(state)
    if (isNewDep) {
        deps.add(state)
        if (data.selectorGraphActive.has(selector)) {
            noteDependencyGraphChanged(selector, data)
            addStateDependent(state, selector, data)
            // New edge: keep the mount-closure marker's no-false-negative invariant.
            noteDependencyAdded(selector, state, data)
        } else {
            // The dependency list no longer aligns with the cold cache's
            // revision array. Force validation/re-evaluation on the next read.
            // Clear the pass stamp too: this can land in a microtask while the
            // pass that validated the snapshot is still the current one (the
            // clock need not have moved), and the pass memo would otherwise
            // serve the value this invalidation exists to retire.
            invalidateColdSelectorCache(selector, data)
            // Retiring this snapshot is not enough. Before the pass memo, an
            // ANCESTOR revalidating always re-read every selector dependency and
            // so pulled the repair through; with the memo a stamped ancestor
            // skips that loop entirely and never sees it. End the pass so every
            // ancestor re-walks, as it used to.
            endColdValidationPassForExternalChange(data.tree)
        }
    }
    return isNewDep
}

/**
 * Post-read half of a late dependency install: promote and mount the newly
 * added edge. `selectorGraphActive` is deliberately re-checked — the value
 * read between the two halves can change it (a cold selector is validated/
 * read before its graph is promoted; promotion bypasses cold-cache
 * validation thereafter).
 */
export const settleLateDependency = (
    selector: Selector,
    state: State,
    data: StoreData,
): void => {
    if (data.selectorGraphActive.has(selector)) {
        activateSelectorGraph(state, data)
        // Mount new dependencies if the selector is live.
        if (isLive(selector, data)) {
            onLiveDependencyAdded(state, data)
            mountTransitiveDeps(state, data)
        }
    }
}

/**
 * Reconcile a resolved async selector's committed dependencies: remove any
 * that were carried forward from a previous evaluation but not read by the
 * evaluation that produced this resolution. `evalDeps` is the kept set.
 * Liveness is snapshotted ONCE before the loop — an unmount cleanup running
 * mid-loop may unsubscribe this selector, and re-checking per dep would
 * change which removals propagate.
 */
export const reconcileAsyncDeps = (
    selector: Selector,
    evalDeps: Set<State>,
    data: StoreData,
): void => {
    const currentDeps = data.stateDependencies.get(selector)
    if (!currentDeps) return
    const tracksReverseEdges = data.selectorGraphActive.has(selector)
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
                removeStateDependent(dep, selector, data)
                if (selectorIsLive) {
                    onLiveDependencyRemoved(dep, data)
                }
                unmountOrphanedDeps(dep, data)
            }
        }
    }
}

/** Speculatively mark a fresh selector as part of the live reverse graph
 * before its first evaluation (a selector discovered below a live selector is
 * itself live by construction). Balanced by `rollbackSelectorActivation` when
 * that evaluation throws. */
export const markSelectorGraphActive = (
    selector: Selector,
    data: StoreData,
): void => {
    data.selectorGraphActive.add(selector)
}

/** Undo a speculative activation after the activating evaluation threw. */
export const rollbackSelectorActivation = (
    selector: Selector,
    data: StoreData,
): void => {
    cleanupOrphanedDeps(selector, data)
    // A selector that threw before committing its dependency set has no graph
    // for cleanupOrphanedDeps to remove, but the active marker is still owned
    // by the evaluation that speculatively added it.
    if (!isLive(selector, data)) data.selectorGraphActive.delete(selector)
}

/** Orphan cleanup may leave the weak active marker behind to keep teardown
 * cheap. With no forward graph a read is fresh, not a live re-evaluation —
 * clear the stale marker before selecting the evaluation mode. */
export const clearStaleSelectorActivation = (
    selector: Selector,
    data: StoreData,
): void => {
    if (!data.stateDependencies.has(selector)) {
        data.selectorGraphActive.delete(selector)
    }
}

/**
 * Apply an installed dependency diff to the incremental liveness/mount
 * bookkeeping. Runs user onMount/cleanup, so callers must invoke it OUTSIDE
 * any error-swallowing re-evaluation guard — a throwing onMount must
 * propagate — and only after the selector's settled value is committed.
 */
export const applyLiveDependencyDiff = (
    selector: Selector,
    added: Set<State> | undefined,
    removed: Set<State> | undefined,
    data: StoreData,
): void => {
    if (!isLive(selector, data)) return
    if (added) {
        for (const dep of added) {
            onLiveDependencyAdded(dep, data)
            mountTransitiveDeps(dep, data)
        }
    }
    if (removed) {
        for (const dep of removed) {
            onLiveDependencyRemoved(dep, data)
            unmountOrphanedDeps(dep, data)
        }
    }
}

/** Mark a store's graph terminal for disposal. Reuses the public-operation
 * orphan guard as the terminal facade marker; this also replaces and releases
 * any queued orphan roots. */
export const sealGraphForDisposal = (data: StoreData): void => {
    data.pendingOrphanCleanup = DISPOSED_STORE_PENDING
}

/** Drop a queued orphan sweep's roots during disposal. The already-enqueued
 * microtask observes the terminal marker and becomes a no-op. */
export const dropQueuedOrphanWork = (data: StoreData): void => {
    data.orphanCleanupScheduled = false
}

/** Release the liveness-pass scratch during disposal. These are transient
 * scratch owners rather than external resources, but clearing them releases
 * any strong states immediately. */
export const resetLivenessScratch = (data: StoreData): void => {
    data.livenessPassActive = false
    data.livenessSeeds = undefined
    data.livenessRemovalArmed = false
    data.livenessLazyArmed = false
    dropGraphWorkspaces(data)
}
