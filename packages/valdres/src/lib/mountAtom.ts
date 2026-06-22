import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { storeFromStoreData } from "./storeFromStoreData"

// Shared immutable empty set — a missing stateDependencies entry (atoms and
// atom-family members are graph sinks) yields a zero-length iterator without
// allocating. Never mutated.
const EMPTY: Set<State> = new Set()

const hasDirectSubscribers = (state: State, data: StoreData): boolean => {
    const subs = data.subscriptions.get(state)
    return !!subs && subs.size > 0
}

/** Does `state` itself carry a mount hook? */
const hasOwnMount = (state: State): boolean =>
    !!(state.__valdresOnMount || state.onMount)

/**
 * "Mount-relevant" = a walk DOWN from `state` could find something to mount:
 * `state` itself has a mount hook, OR a strict descendant does (the cached
 * `mountInClosure` marker). When this is false, `mountTransitiveDeps` /
 * `unmountOrphanedDeps` are pure no-ops and can return before allocating.
 */
const hasMountInClosure = (state: State, data: StoreData): boolean =>
    hasOwnMount(state) || data.mountInClosure.has(state)

/**
 * Push the `mountInClosure` marker UP from `state` to its dependents. Called
 * when `state` newly became mount-relevant (so each selector that reads it now
 * has a mountable descendant). Monotonic BFS over `stateDependents`: a parent
 * is marked and recursed into only when it was NOT already mount-relevant —
 * a parent that already had the marker (or its own hook) had its own ancestors
 * accounted for when that became true, so the walk stops there. This bounds the
 * work to the genuinely-newly-marked frontier and is cycle-safe (a node is
 * pushed at most once, when its key flips absent→present).
 */
const propagateMountMarkerUp = (state: State, data: StoreData) => {
    const stack: State[] = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        const parents = data.stateDependents.get(current)
        if (!parents) continue
        for (const parent of parents) {
            if (data.mountInClosure.has(parent)) continue
            // parent gains a mount-relevant child → it now has a mountable
            // descendant. Record the marker regardless of parent's own hook.
            data.mountInClosure.set(parent, true)
            // Only ascend through parents that were not ALREADY mount-relevant
            // via their own hook — those had their ancestors marked when their
            // hook-bearing edges first formed, so re-ascending is redundant.
            if (!hasOwnMount(parent)) stack.push(parent)
        }
    }
}

/**
 * Record that `dep` just became a (strict) dependency of `selector`. If `dep`
 * is mount-relevant, `selector`'s downward closure now contains a mountable
 * node, so ensure `selector` carries the `mountInClosure` marker and propagate
 * it up to `selector`'s dependents. The common case — `dep` mount-free — is a
 * single `WeakMap.has` and return, so steady-state graph churn over mount-free
 * subgraphs stays allocation- and walk-free.
 *
 * Must be called for EVERY new dependency edge (every place a forward
 * `stateDependencies` / reverse `stateDependents` edge is created), because the
 * skip in `mountTransitiveDeps` trusts the marker's no-false-negative invariant.
 */
export const noteDependencyAdded = (
    selector: State,
    dep: State,
    data: StoreData,
) => {
    if (!hasMountInClosure(dep, data)) return
    if (data.mountInClosure.has(selector)) return
    data.mountInClosure.set(selector, true)
    // If `selector` already had its own hook it was already mount-relevant, so
    // its dependents were marked when their edges formed — no up-walk needed.
    if (!hasOwnMount(selector)) propagateMountMarkerUp(selector, data)
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
 * memoizes fully-explored acyclic subgraphs. Only selectors are keyed in
 * `stateDependencies`; atoms and atom-family members are graph sinks (no
 * out-edges), so a region of pure atom deps returns false in O(seeds).
 * (selectorFamily members ARE selectors and do have out-edges.)
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
 * Begin a liveness-reconcile pass. Returns true iff THIS call owns the pass (the
 * outermost one) — a nested pass returns false and must not release or reconcile.
 * The collector Set (`livenessSeeds`) is allocated lazily by `evaluateSelector` on
 * the first actual seed, so a no-churn / first-init pass stays allocation-free.
 */
export const beginLivenessPass = (data: StoreData): boolean => {
    if (data.livenessPassActive) return false
    data.livenessPassActive = true
    data.livenessRemovalArmed = false
    data.livenessLazyArmed = false
    return true
}

/**
 * End the liveness pass owned by the caller: reset all per-pass state and return
 * the seed region to reconcile, or null if none is owed. This is the single
 * definition of the reconcile gate — a lazy re-init arms it unconditionally (the
 * incremental path never ran for those edges); a removal arms it only when the
 * region has a cycle (both bugs a removal can cause require one, and an acyclic
 * removal is already exact incrementally).
 *
 * Call from the owning pass's `finally` so a throwing onMount still releases the
 * collector — but reconcile the RETURNED region AFTER that finally, never inside
 * it: `reconcileLivenessAfterChurn` re-enters user onMount/cleanup, so running it
 * while an exception is in flight would mask the original error.
 */
export const endLivenessPass = (data: StoreData): Set<State> | null => {
    const seeds = data.livenessSeeds as Set<State> | undefined
    const lazyArmed = data.livenessLazyArmed
    const removalArmed = data.livenessRemovalArmed
    // Reset flags to false (not undefined) so the property stays monomorphic
    // boolean; livenessSeeds back to undefined = "unallocated / no owner".
    data.livenessPassActive = false
    data.livenessSeeds = undefined
    data.livenessLazyArmed = false
    data.livenessRemovalArmed = false
    if (
        seeds &&
        seeds.size > 0 &&
        (lazyArmed || (removalArmed && regionHasCycle(seeds, data)))
    ) {
        return seeds
    }
    return null
}

/**
 * Re-derive `liveDependentCount` from ground-truth reachability for a churned
 * region. This is the backstop the incremental `onLiveDependency{Added,Removed}`
 * bookkeeping can't replace, because that bookkeeping fails in two ways the
 * caller has detected (see `endLivenessPass`, which gates and invokes this):
 *
 *  - REMOVAL into a cycle. A reference count can't collect a cyclic group (their
 *    mutual edges keep each other's count > 0 → leak), and a TRANSIENT removal by
 *    a multiply-evaluated selector tears down a subtree via `propagateNotLive`
 *    that a later same-pass re-add then skips (the `isLive` guard is now false),
 *    stranding a still-read subtree non-live → freeze. Both require a cycle in the
 *    region, which is why the caller gates the removal case on `regionHasCycle`.
 *  - LAZY re-init through `get` commits dep edges outside the propagation loop, so
 *    the incremental calls never ran for them at all.
 *
 * `seeds` is the region's seed set: the selectors whose dependency SET changed
 * this pass plus the removed deps (so its DOWNWARD dependency closure covers
 * every state a teardown or a lazy re-wire could have mis-counted —
 * `propagateNotLive` only ever walks dependencies, so a cascade can't escape it).
 * We recompute the invariant
 *
 *   liveDependentCount[D] = |{ S ∈ stateDependents[D] : isLive(S) }|
 *
 * for exactly that region: dependents OUTSIDE the region keep their (unaffected)
 * cached liveness as the fixed base, and a worklist fixpoint resolves liveness for
 * dependents INSIDE it (the region can contain cycles — recursive
 * selectorFamilies). The caller only invokes this when a dep-set actually changed
 * AND a flag was armed, so the steady-state propagation path never reaches here.
 */
export const reconcileLivenessAfterChurn = (
    seeds: Set<State>,
    data: StoreData,
) => {
    // 1. region = downward dependency closure of the seeds.
    const region = new Set<State>()
    const stack: State[] = [...seeds]
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
    // Share a visited set across all mount calls (and a separate one across all
    // unmount calls) so overlapping transitive subtrees are walked once total, not
    // once per transitioning region node — O(region + edges), not O(region *
    // edges). Mount and unmount must NOT share a set: a node skipped by an unmount
    // walk must still be reachable by a mount walk, and vice versa.
    const mountVisited = new Set<State>()
    const unmountVisited = new Set<State>()
    for (const D of region) {
        const now = live.has(D)
        if (now && !wasLive.get(D)) mountTransitiveDeps(D, data, mountVisited)
        else if (!now && wasLive.get(D))
            unmountOrphanedDeps(D, data, unmountVisited)
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
    // Fast path: nothing mountable here or anywhere reachable below. The cached
    // `mountInClosure` marker generalizes the old leaf-only check to any subtree
    // that is entirely mount-free (the common case) — skip the Set alloc + walk.
    if (!hasMountInClosure(state, data)) return
    // A standalone walk (no shared `visited`) covers the FULL strict-descendant
    // closure, so we can recompute the marker exactly: if no descendant turns
    // out to be mountable, clear the (now stale) marker. Skipped when a `visited`
    // set is shared across sibling walks, where this walk may be truncated.
    const canRecomputeMarker = visited === undefined
    let sawMountDescendant = false
    const seen = visited ?? new Set<State>()
    let firstError: { value: unknown } | null = null
    const stack: State[] = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        if (seen.has(current)) continue
        seen.add(current)
        if (current.__valdresOnMount || current.onMount) {
            if (current !== state) sawMountDescendant = true
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
    if (canRecomputeMarker && !sawMountDescendant) {
        data.mountInClosure.delete(state)
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
    // Fast path: nothing mountable here or anywhere reachable below means
    // nothing could be mounted beneath it either. Skip the Set alloc + walk.
    if (!hasMountInClosure(state, data)) return
    // See mountTransitiveDeps: a standalone walk can clear a now-stale marker.
    const canRecomputeMarker = visited === undefined
    let sawMountDescendant = false
    const seen = visited ?? new Set<State>()
    let firstError: { value: unknown } | null = null
    const stack: State[] = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        if (seen.has(current)) continue
        seen.add(current)
        if (current.__valdresOnMount || current.onMount) {
            if (current !== state) sawMountDescendant = true
            if (data.mounts.has(current) && !isLive(current, data)) {
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
    if (canRecomputeMarker && !sawMountDescendant) {
        data.mountInClosure.delete(state)
    }
    if (firstError) {
        throw firstError.value
    }
}
