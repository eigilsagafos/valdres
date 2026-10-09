import type { State } from "../../types/State"
import type { StoreData } from "../../types/StoreData"
import type { Selector } from "../../types/Selector"
import { removeStateDependent } from "./inheritedDependencyBranches"
import { isLive } from "./mountAtom"
import { graphNodeFor, peekGraphNode } from "./graphNode"
import {
    noteStateValueChanged,
    recordColdSelectorCache,
} from "../stateRevisions"
import { untrackAbortController } from "../storeLifecycle"
import { hasCommittedValue } from "../hasCommittedValue"
import { isPromiseLike } from "../../utils/isPromiseLike"

/**
 * Remove non-live states from the dependency graph, clear selector caches, and
 * recursively clean orphaned dependencies/dependents. Visit marks persist for
 * one topology generation so every state is processed once across a queued
 * sibling-unsubscribe burst.
 */
export const cleanupOrphanedDeps = (state: State, data: StoreData) => {
    // A live root has nothing to clean. This is the dominant shape for wide
    // fan-in teardown until the aggregator itself unsubscribes.
    if (isLive(state, data)) return

    const graphVersion = data.dependencyGraphVersion
    if (peekGraphNode(state, data)?.cleanedAt === graphVersion) return

    const stack = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        // Live boundaries are deliberately NOT marked: a later burst may make
        // one transition to non-live, at which point it needs cleanup.
        // Peek: this walk stops at every live boundary it reaches, and those
        // nodes must not be given a record just to be skipped.
        const currentNode = peekGraphNode(current, data)
        if (currentNode?.cleanedAt === graphVersion) continue
        if (isLive(current, data)) continue
        ;(currentNode ?? graphNodeFor(current, data)).cleanedAt = graphVersion

        const dependents = data.stateDependents.get(current)
        const deps = data.stateDependencies.get(current)
        if (deps) {
            // Revoke the evaluation before removing its graph. Deferred `get`
            // closures capture this object, so flipping it first makes every
            // post-cleanup read read-only even after the WeakMap entry is gone.
            // This also gives pending Promise handlers an evaluation-identity
            // guard stronger than `stateDependencies.has`, which a stale late
            // `get` or a newer evaluation can make true again.
            const selector = current as Selector
            const evaluationContext = data.latestEvalContext.get(selector)
            if (evaluationContext) {
                // Unmount invalidates store ownership but intentionally keeps
                // the public AbortSignal alive. Re-evaluation still aborts the
                // superseded signal through evaluateSelector's normal path.
                evaluationContext.preserveSignal()
                evaluationContext.revoke()
            }
            data.latestEvalContext.delete(selector)

            // Dependents are enqueued BEFORE the dependency loop below so the
            // stack ends up in the same order it had when the enqueue was a
            // second pass after the demote: dependents pushed first, then
            // dependencies, so LIFO still pops dependencies first. That order is
            // load-bearing — a dependency that takes the DROP branch bumps its
            // own revision, and a dependent demoted afterwards snapshots the
            // post-drop revision. Reversing it would silently change which
            // revision a cold cache records.
            if (dependents) {
                for (const dependent of dependents) stack.push(dependent)
            }
            // Release the reverse edge and enqueue the dependency for its own
            // orphan check in ONE pass, instead of two loops over the same Set
            // (which walked every edge twice and allocated a second Set iterator
            // per selector). Safe to interleave: `stack` is only consumed by
            // later pops, and cleanup never touches `subscriptions` or
            // `liveDependentCount`, so the `isLive` verdict each pop reads is
            // fixed for the whole sweep.
            for (const dep of deps) {
                removeStateDependent(dep, current, data)
                stack.push(dep)
            }
            // Demote rather than drop: leave the selector in EXACTLY the shape
            // a cold read produces — committed value, forward dependency set,
            // revision-snapshot cache, no reverse edges, no active marker. That
            // shape already has a promote path (`onFirstDirectSubscriber` ->
            // `activateSelectorGraph` rebuilds the reverse graph from the
            // retained forward set) and a staleness path (a dependency write
            // advances the tree revision, so the next read revalidates and
            // re-evaluates). A remount therefore costs edge re-wiring instead
            // of re-running the selector body — the difference between 0 and N
            // re-evaluations for a subscribed graph that churns.
            //
            // A pending async value is NOT demotable: the abort controller is
            // untracked below and the settlement handlers are keyed to the
            // evaluation identity revoked above, so its promise must never be
            // served from a cache. Drop those the old way.
            //
            // Neither is anything in an `enumerable` store, where `values` is a
            // strong Map: retention there would outlive the selector instead of
            // dying with it, and `store.snapshot()` — public API, and what
            // @valdres/redux-devtools enumerates — would start listing
            // torn-down selectors. Enumerable stores exist for observability,
            // so they keep the drop semantics and pay the re-evaluation.
            const committed = data.values.get(current)
            if (
                !data.enumerable &&
                hasCommittedValue(current, data, committed) &&
                !isPromiseLike(committed)
            ) {
                // Clear the marker FIRST: `recordColdSelectorCache` treats an
                // active selector as live and would delete the cache instead of
                // writing it. Dropping the marker is also what lets
                // `activateSelectorGraph` (which early-returns on an active
                // marker) rebuild the reverse graph on the next subscribe.
                data.selectorGraphActive.delete(current as Selector)
                recordColdSelectorCache(current as Selector, deps, data)
            } else {
                data.stateDependencies.delete(current)
                // The active marker is weak and can remain through teardown. A
                // later subscription overwrites it while rebuilding the live
                // graph; a later cold read clears it on the cache-miss path
                // before evaluation. Deferring that delete keeps synchronous
                // unsubscribe bursts from paying one extra WeakSet mutation per
                // selector. Live-only stores never instantiate the cold-cache
                // WeakMap. Keep their batched teardown to the original
                // graph/value work.
                if (data.coldSelectorCachesEnabled) {
                    data.coldSelectorCaches.delete(current)
                }
                if (data.values.delete(current)) {
                    if (data.tree.revisionEnabled) {
                        noteStateValueChanged(current, data)
                    }
                }
            }
            untrackAbortController(
                data,
                data.abortControllers.get(current as Selector),
            )
            data.abortControllers.delete(current)

            // Dependents and dependencies were both enqueued above.
            continue
        }

        if (dependents) {
            for (const dependent of dependents) stack.push(dependent)
        }
    }
}
