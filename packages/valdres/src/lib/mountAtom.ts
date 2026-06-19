import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { storeFromStoreData } from "./storeFromStoreData"

// Shared immutable empty set — a missing stateDependencies entry (atoms /
// family-members are graph sinks) yields a zero-length iterator without
// allocating. Never mutated.
const EMPTY: Set<State> = new Set()

const hasDirectSubscribers = (state: State, data: StoreData): boolean => {
    const subs = data.subscriptions.get(state)
    return !!subs && subs.size > 0
}

/**
 * Cached liveness check. A state is "live" (transitively subscribed) iff it
 * has direct subscribers OR at least one of its dependents (selectors that
 * read it) is itself live. The "live dependent" contribution is tracked
 * incrementally in `data.liveDependentCount`, so this is O(1).
 */
export const isLive = (state: State, data: StoreData): boolean => {
    if (hasDirectSubscribers(state, data)) return true
    const count = data.liveDependentCount.get(state)
    return !!count && count > 0
}

/**
 * Propagate a "just became live" transition through the state's dependency
 * graph. For each dependency D of the state, the state itself counts as one
 * more live dependent of D. If that flips D from not-live to live, recurse.
 */
const propagateLive = (root: State, data: StoreData) => {
    const stack: State[] = [root]
    while (stack.length > 0) {
        const current = stack.pop()!
        const deps = data.stateDependencies.get(current)
        if (!deps) continue
        for (const dep of deps) {
            const prev = data.liveDependentCount.get(dep) ?? 0
            data.liveDependentCount.set(dep, prev + 1)
            if (prev === 0 && !hasDirectSubscribers(dep, data)) {
                stack.push(dep)
            }
        }
    }
}

/**
 * Propagate a "just became not-live" transition through the state's
 * dependency graph. Mirror of propagateLive.
 */
const propagateNotLive = (root: State, data: StoreData) => {
    const stack: State[] = [root]
    while (stack.length > 0) {
        const current = stack.pop()!
        const deps = data.stateDependencies.get(current)
        if (!deps) continue
        for (const dep of deps) {
            const prev = data.liveDependentCount.get(dep) ?? 0
            const next = prev - 1
            if (next <= 0) {
                data.liveDependentCount.delete(dep)
            } else {
                data.liveDependentCount.set(dep, next)
            }
            if (prev === 1 && !hasDirectSubscribers(dep, data)) {
                stack.push(dep)
            }
        }
    }
}

/**
 * Direct subscribers on `state` just transitioned from 0 → 1. If the state
 * wasn't already live via dependents, mark it live and propagate.
 */
export const onFirstDirectSubscriber = (state: State, data: StoreData) => {
    const liveDepCount = data.liveDependentCount.get(state) ?? 0
    if (liveDepCount === 0) {
        propagateLive(state, data)
    }
}

/**
 * Direct subscribers on `state` just transitioned from 1 → 0. If the state
 * has no live dependents either, it transitions to not-live and we
 * propagate.
 */
export const onLastDirectSubscriber = (state: State, data: StoreData) => {
    const liveDepCount = data.liveDependentCount.get(state) ?? 0
    if (liveDepCount === 0) {
        propagateNotLive(state, data)
    }
}

/**
 * A live selector gained dependency `dep`. Register the contribution to
 * dep's liveDependentCount; if dep transitions to live, propagate.
 */
export const onLiveDependencyAdded = (dep: State, data: StoreData) => {
    const prev = data.liveDependentCount.get(dep) ?? 0
    data.liveDependentCount.set(dep, prev + 1)
    if (prev === 0 && !hasDirectSubscribers(dep, data)) {
        propagateLive(dep, data)
    }
}

/**
 * A live selector lost dependency `dep`. Decrement and propagate not-live
 * if the contribution was the last one keeping dep alive.
 */
export const onLiveDependencyRemoved = (dep: State, data: StoreData) => {
    const prev = data.liveDependentCount.get(dep) ?? 0
    const next = prev - 1
    if (next <= 0) {
        data.liveDependentCount.delete(dep)
    } else {
        data.liveDependentCount.set(dep, next)
    }
    if (prev === 1 && !hasDirectSubscribers(dep, data)) {
        propagateNotLive(dep, data)
    }
}

/**
 * Does the DOWNWARD (dependency) closure of `seeds` contain a directed cycle?
 *
 * This is the exact gate for the removal-armed liveness reconcile. Both bugs the
 * reconcile fixes provably require a cycle inside the affected region:
 *  - FREEZE: a still-live selector S is stranded only if `propagateNotLive`,
 *    walking DOWN from a removed dep D, reaches back to S — i.e. D depends
 *    (transitively) on S while S reads D, a cycle through D and S.
 *  - LEAK: a reference count fails to drain only a cycle; a DAG always drains
 *    via the `prev === 1` guard.
 * So on an acyclic region the incremental onLiveDependencyRemoved + propagateNotLive
 * already equals ground truth and the reconcile is a no-op — skip it.
 *
 * Iterative DFS over `data.stateDependencies` (down-edges only) restricted to the
 * seeds' closure; an `onPath` (gray) set detects a back-edge, a `done` (black) set
 * memoizes fully-explored acyclic subgraphs. Atoms/family-members are never keyed
 * in `stateDependencies` (they are graph sinks), so a region of pure atom deps has
 * no out-edges and returns false in O(seeds).
 */
export const regionHasCycle = (
    seeds: Set<State>,
    data: StoreData,
): boolean => {
    const done = new Set<State>()
    const onPath = new Set<State>()
    // Explicit stack of frames: { node, iterator over its deps }. A frame is
    // pushed onto `onPath` when entered and moved to `done` when its deps are
    // exhausted; encountering a node already `onPath` is a back-edge → cycle.
    for (const seed of seeds) {
        if (done.has(seed)) continue
        const stack: { node: State; it: Iterator<State> }[] = [
            { node: seed, it: (data.stateDependencies.get(seed) ?? EMPTY).values() },
        ]
        onPath.add(seed)
        while (stack.length > 0) {
            const frame = stack[stack.length - 1]!
            const next = frame.it.next()
            if (next.done) {
                onPath.delete(frame.node)
                done.add(frame.node)
                stack.pop()
                continue
            }
            const dep = next.value as State
            if (onPath.has(dep)) return true // back-edge → cycle
            if (done.has(dep)) continue
            onPath.add(dep)
            stack.push({
                node: dep,
                it: (data.stateDependencies.get(dep) ?? EMPTY).values(),
            })
        }
    }
    return false
}

/**
 * Reconcile `liveDependentCount` after a selector-update propagation pass that
 * removed dependencies.
 *
 * The incremental `onLiveDependency{Added,Removed}` bookkeeping is not robust to
 * a selector being re-evaluated MORE THAN ONCE within a single pass with
 * transitional (non-final) dependency sets — which the topological scheduler
 * does (a selector that is both in the initial dirty set and downstream of
 * another, plus escaped/stranded re-evals). A transient dependency removal by a
 * still-live selector eagerly tears down the `liveDependentCount` of an entire
 * transitive subtree (via `propagateNotLive`); when the dependency is re-added
 * later in the same pass, the `isLive(selector)` guard is now false (the
 * selector was itself caught in that teardown), so the re-add is skipped and the
 * subtree is left permanently non-live even though a live subscriber still
 * reads it. `propagateDirtySelectors` then skips it forever → stale value.
 *
 * Every state whose count a teardown can corrupt lies in the DOWNWARD
 * (dependency) closure of the deps removed during the pass — `propagateNotLive`
 * only ever walks dependencies, so a cascade can't escape that closure; and a
 * wrongly-skipped re-add only matters for a dependency of a selector that was
 * itself torn down (hence already in the closure). We recompute the invariant
 *
 *   liveDependentCount[D] = |{ S ∈ stateDependents[D] : isLive(S) }|
 *
 * for exactly that region from ground truth: dependents OUTSIDE the region keep
 * their (unaffected) cached liveness as the fixed base, and a worklist fixpoint
 * resolves liveness for dependents INSIDE it (the region can contain cycles —
 * recursive selectorFamilies). Gated by the caller on `removed.size > 0`, so the
 * steady-state propagation path (no dependency removals) is untouched.
 */
export const reconcileLivenessAfterChurn = (
    removed: Set<State>,
    data: StoreData,
) => {
    // 1. region = downward dependency closure of the removed deps.
    const region = new Set<State>()
    const stack: State[] = [...removed]
    while (stack.length > 0) {
        const s = stack.pop()!
        if (region.has(s)) continue
        region.add(s)
        const deps = data.stateDependencies.get(s)
        if (deps) for (const d of deps) if (!region.has(d)) stack.push(d)
    }

    // 2. Ground-truth liveness for the region. Seed from direct subscribers and
    //    from dependents OUTSIDE the region (their liveness is unaffected by
    //    this churn, so the cached isLive() is authoritative). Then push
    //    liveness DOWN: a live state's dependencies each gain a live dependent.
    const live = new Set<State>()
    const work: State[] = []
    for (const D of region) {
        let isit = hasDirectSubscribers(D, data)
        if (!isit) {
            const dependents = data.stateDependents.get(D)
            if (dependents) {
                for (const T of dependents) {
                    if (!region.has(T) && isLive(T, data)) {
                        isit = true
                        break
                    }
                }
            }
        }
        if (isit) {
            live.add(D)
            work.push(D)
        }
    }
    while (work.length > 0) {
        const T = work.pop()!
        const deps = data.stateDependencies.get(T)
        if (!deps) continue
        for (const D of deps) {
            if (region.has(D) && !live.has(D)) {
                live.add(D)
                work.push(D)
            }
        }
    }

    // 3. Recompute counts from ground truth, snapshotting prior liveness so we
    //    can mount/unmount on genuine transitions afterwards (idempotent).
    const wasLive = new Map<State, boolean>()
    for (const D of region) wasLive.set(D, isLive(D, data))
    for (const D of region) {
        const dependents = data.stateDependents.get(D)
        let count = 0
        if (dependents) {
            for (const T of dependents) {
                if (region.has(T) ? live.has(T) : isLive(T, data)) count++
            }
        }
        // liveDependentCount never stores 0 (entries are deleted at <= 0), so a
        // missing entry IS count 0 — only touch the map on a genuine change.
        const prev = data.liveDependentCount.get(D) ?? 0
        if (count === prev) continue
        if (count <= 0) data.liveDependentCount.delete(D)
        else data.liveDependentCount.set(D, count)
    }
    for (const D of region) {
        const now = live.has(D)
        if (now && !wasLive.get(D)) mountTransitiveDeps(D, data)
        else if (!now && wasLive.get(D)) unmountOrphanedDeps(D, data)
    }
}

/**
 * Mount a single atom: call its onMount and store the cleanup in data.mounts.
 * No-op if the atom has no onMount or is already mounted.
 *
 * Checks `__valdresOnMount` first (set by compat layers that need to wrap
 * the onMount signature), then falls back to `onMount`.
 */
export const mountAtom = (state: State, data: StoreData) => {
    const onMountFn = state.__valdresOnMount ?? state.onMount
    if (!onMountFn || data.mounts.has(state)) return
    // Mark as mounted BEFORE calling onMountFn to prevent reentrant mounts
    // (onMount may call setSelf which triggers propagation and dep changes)
    const mountEntry: { cleanup?: () => void } = {}
    data.mounts.set(state, mountEntry)
    const store = data.storeRef ?? storeFromStoreData(data)
    try {
        const result = onMountFn(store, state)
        if (typeof result === "function") mountEntry.cleanup = result
    } catch (error) {
        data.mounts.delete(state)
        throw error
    }
}

/**
 * Unmount a single atom: remove it from data.mounts and call its cleanup.
 * No-op if the atom is not mounted.
 */
export const unmountAtom = (state: State, data: StoreData) => {
    const mount = data.mounts.get(state)
    if (!mount) return
    data.mounts.delete(state)
    if (typeof mount.cleanup === "function") {
        mount.cleanup()
    }
}

/**
 * Walk the transitive dependencies of a state and mount any atoms that have
 * onMount. Called when a state gains its first transitive subscriber.
 * Uses an iterative approach to avoid stack overflow on deep dependency chains.
 * Continues mounting remaining atoms even if one throws, then re-throws
 * the first error.
 */
export const mountTransitiveDeps = (
    state: State,
    data: StoreData,
    visited?: Set<State>,
) => {
    // Fast path: leaf state with no onMount means there is nothing to mount
    // anywhere reachable from here. Skip the Set/Array allocation and walk.
    if (!state.__valdresOnMount && !state.onMount) {
        const deps = data.stateDependencies.get(state)
        if (!deps || deps.size === 0) return
    }
    const seen = visited ?? new Set<State>()
    let firstError: { value: unknown } | null = null
    const stack: State[] = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        if (seen.has(current)) continue
        seen.add(current)
        if (current.__valdresOnMount || current.onMount) {
            try {
                mountAtom(current, data)
            } catch (error) {
                if (!firstError) firstError = { value: error }
            }
        }
        const deps = data.stateDependencies.get(current)
        if (deps) {
            for (const dep of deps) {
                if (!seen.has(dep)) stack.push(dep)
            }
        }
    }
    if (firstError) {
        throw firstError.value
    }
}

/**
 * Check if a state should be unmounted (no longer transitively subscribed)
 * and unmount it if so. Uses iterative traversal for deep dependency chains.
 * Continues unmounting remaining atoms even if one throws, then re-throws
 * the first error.
 */
export const unmountOrphanedDeps = (
    state: State,
    data: StoreData,
    visited?: Set<State>,
) => {
    // Fast path: leaf state with no onMount can't have anything mounted
    // beneath it. Skip the Set/Array allocation and walk.
    if (!state.__valdresOnMount && !state.onMount) {
        const deps = data.stateDependencies.get(state)
        if (!deps || deps.size === 0) return
    }
    const seen = visited ?? new Set<State>()
    let firstError: { value: unknown } | null = null
    const stack: State[] = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        if (seen.has(current)) continue
        seen.add(current)
        if ((current.__valdresOnMount || current.onMount) && data.mounts.has(current)) {
            if (!isLive(current, data)) {
                try {
                    unmountAtom(current, data)
                } catch (error) {
                    if (!firstError) firstError = { value: error }
                }
            }
        }
        const deps = data.stateDependencies.get(current)
        if (deps) {
            for (const dep of deps) {
                if (!seen.has(dep)) stack.push(dep)
            }
        }
    }
    if (firstError) {
        throw firstError.value
    }
}
