import type { Atom } from "../types/Atom"
import type { ColdSelectorCache, StoreData } from "../types/StoreData"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import { SelectorCircularDependencyError } from "../errors/SelectorCircularDependencyError"
import { isSelector } from "../utils/isSelector"
import { IS_PROD } from "./IS_PROD"
import { recordColdCacheDependencyChecks } from "./architectureInstrumentation"
import {
    activateSelectorGraph,
    clearStaleSelectorActivation,
    cleanupOrphanedDeps,
    queueObservedCleanups,
    regionHasCycle,
} from "./graph"
import { getState } from "./getState"
import { initSelector } from "./initSelector"
import { getStateRevision, invalidateColdSelectorCache } from "./stateRevisions"

type ColdClosure = {
    /** Dependency-before-dependent order for an acyclic closure. */
    order: Selector[]
    cyclic: boolean
}

/**
 * Collect only the inactive selector closure that promotion will consume.
 * Active selectors are current through push propagation and form boundaries.
 */
const collectColdClosure = (
    root: Selector,
    data: StoreData,
    stopAtActive = true,
): ColdClosure => {
    const order: Selector[] = []
    const visited = new WeakSet<Selector>()
    const onPath = new WeakSet<Selector>()
    const stack: {
        selector: Selector
        dependencies: Iterator<State>
    }[] = []
    let cyclic = false

    const push = (selector: Selector) => {
        visited.add(selector)
        onPath.add(selector)
        stack.push({
            selector,
            dependencies: (
                data.stateDependencies.get(selector) ?? new Set<State>()
            ).values(),
        })
    }

    push(root)
    while (stack.length > 0) {
        const frame = stack[stack.length - 1]!
        const next = frame.dependencies.next()
        if (next.done) {
            onPath.delete(frame.selector)
            order.push(frame.selector)
            stack.pop()
            continue
        }

        const dependency = next.value
        if (!isSelector(dependency)) continue
        if (stopAtActive && data.selectorGraphActive.has(dependency)) {
            // Cheap orphan teardown may intentionally leave an active marker
            // after dropping a graph-less selector value. It is not a valid
            // live boundary: include it in this closure so the dependency is
            // evaluated in graph mode before its parent consumes it.
            clearStaleSelectorActivation(dependency, data)
            if (data.selectorGraphActive.has(dependency)) continue
        }
        if (onPath.has(dependency)) {
            cyclic = true
            continue
        }
        if (!visited.has(dependency)) push(dependency)
    }

    return { order, cyclic }
}

const cacheNeedsRefresh = (
    cache: ColdSelectorCache | undefined,
    data: StoreData,
    revisions: WeakMap<WeakKey, number>,
): boolean => {
    if (!cache || cache.validatedAt < 0) return true
    if (cache.validatedAt === data.tree.revision) return false
    if (cache.dependencies.length !== cache.dependencyRevisions.length) {
        return true
    }

    if (!IS_PROD)
        recordColdCacheDependencyChecks(data, cache.dependencies.length)
    for (let index = 0; index < cache.dependencies.length; index++) {
        const dependency = cache.dependencies[index]!
        let revision = revisions.get(dependency)
        if (revision === undefined) {
            revision = getStateRevision(dependency, data)
            revisions.set(dependency, revision)
        }
        if (revision !== cache.dependencyRevisions[index]) return true
    }
    return false
}

/**
 * Promote a cold selector closure and catch it up through the restored reverse
 * graph. Each dependency revision is resolved at most once, each stale selector
 * body runs at most once, and equality prevents unchanged children from waking
 * their parents. This replaces recursive pull validation for framework
 * snapshot reads while preserving it for ordinary cold `get()` calls and the
 * standalone subscription boundary.
 */
export const reviveColdSelectorGraph = <Value>(
    root: Selector<Value>,
    data: StoreData,
    initializedAtomsSet: Set<Atom>,
    circularDependencySet: WeakSet<Selector>,
): Value => {
    const closure = collectColdClosure(root, data)
    // Queue the old closure, not only its root: a dynamic re-evaluation below
    // can remove an edge and make an activated former dependency unreachable
    // from the root before abandoned-render cleanup runs.
    queueObservedCleanups(root, closure.order, data)

    // Cached cyclic graphs need the recursive guard's provisional semantics.
    // Validate before promotion consumes their cold metadata, then return them
    // to the live path. Acyclic application graphs take the push path below.
    if (closure.cyclic) {
        const value = getState(
            root,
            data,
            initializedAtomsSet,
            circularDependencySet,
        )
        activateSelectorGraph(root, data)
        return value
    }

    const dirty = new WeakSet<Selector>()
    const promoted = new WeakSet<Selector>()
    const revisions = new WeakMap<WeakKey, number>()
    for (const selector of closure.order) {
        promoted.add(selector)
        if (
            cacheNeedsRefresh(
                data.coldSelectorCaches.get(selector),
                data,
                revisions,
            )
        ) {
            dirty.add(selector)
        }
    }

    activateSelectorGraph(root, data)

    // `order` is post-order, so a changed child marks parents that have not yet
    // run. Dynamic dependencies discovered during an evaluation still read
    // through getState and are validated before their edge is installed.
    for (const selector of closure.order) {
        if (!dirty.has(selector)) continue
        if (
            initSelector(
                selector,
                data,
                initializedAtomsSet,
                circularDependencySet,
            )
        ) {
            const dependents = data.stateDependents.get(selector)
            if (!dependents) continue
            for (const dependent of dependents) {
                if (promoted.has(dependent as Selector)) {
                    dirty.add(dependent as Selector)
                }
            }
        }
    }

    // A dynamic branch may add a back-edge that was absent from the cached
    // closure collected above. Promotion's edge installer marks that risk; an
    // exact check here prevents a provisionally active graph from serving the
    // inconsistent latched values that a selector cycle can otherwise create.
    if (data.cycleRiskInClosure.has(root) && regionHasCycle(root, data)) {
        // No subscriber has claimed this graph yet, so synchronously restore
        // the cold shape before throwing. A second getSnapshot in the same turn
        // must hit the recursive cycle guard again rather than cache-hit the
        // provisional values committed above.
        const cycleClosure = collectColdClosure(root, data, false).order
        cleanupOrphanedDeps(root, data)
        for (const selector of cycleClosure) {
            invalidateColdSelectorCache(selector, data)
        }
        const error = new SelectorCircularDependencyError()
        error.track(root)
        throw error
    }

    // Re-entrant writes from a selector body may run propagation while this
    // provisional graph has no live root yet. That pass can legitimately drop
    // the observed root's value; finish through getState so the snapshot handed
    // to the framework is always materialized and current.
    return getState(root, data, initializedAtomsSet, circularDependencySet)
}
