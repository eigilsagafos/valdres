import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Selector } from "../types/Selector"
import { isLive } from "./mountAtom"

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
    const cleanedAtVersion = data.orphanCleanupVersion
    if (cleanedAtVersion.get(state) === graphVersion) return

    const stack = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        // Live boundaries are deliberately NOT marked: a later burst may make
        // one transition to non-live, at which point it needs cleanup.
        if (cleanedAtVersion.get(current) === graphVersion) continue
        if (isLive(current, data)) continue
        cleanedAtVersion.set(current, graphVersion)

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
                evaluationContext.preserveSignalOnRevoke = true
                evaluationContext.revoked = true
            }
            data.latestEvalContext.delete(selector)

            for (const dep of deps) {
                data.stateDependents.get(dep)?.delete(current)
            }
            data.stateDependencies.delete(current)
            data.selectorGraphActive.delete(current)
            data.coldSelectorCaches.delete(current)
            data.values.delete(current)
            data.abortControllers.delete(current)

            if (dependents) {
                for (const dependent of dependents) stack.push(dependent)
            }
            for (const dep of deps) stack.push(dep)
            continue
        }

        if (dependents) {
            for (const dependent of dependents) stack.push(dependent)
        }
    }
}
