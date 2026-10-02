import type { State } from "../../types/State"
import type { StoreData } from "../../types/StoreData"
import type { InternalState } from "../../types/InternalState"
import { isSelector } from "../../utils/isSelector"
import { IS_PROD } from "../IS_PROD"
import { addStateDependent } from "./inheritedDependencyBranches"
import { noteDependencyGraphChanged } from "./noteDependencyGraphChanged"
import {
    acquireLivenessWorkspace,
    ensureLive,
    ensureMountVisited,
    ensureOnPath,
    ensureRegion,
    ensureUnmountVisited,
    ensureWasLive,
    noteLivenessWorkspaceSize,
    releaseLivenessWorkspace,
} from "./workspace"
import { graphNodeFor, liveDependents, peekGraphNode, UNSET } from "./graphNode"
import { getStoreRuntime } from "../getStoreRuntime"
import {
    isStoreDisposed,
    trackStoreMount,
    untrackStoreMount,
} from "../storeLifecycle"

// Shared immutable empty set — a missing stateDependencies entry (atoms and
// atom-family members are graph sinks) yields a zero-length iterator without
// allocating. Never mutated.
const EMPTY: Set<State> = new Set()

const recordLivenessEdge = (data: StoreData) => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation) instrumentation.counters.livenessEdgeVisits++
}

const recordMount = (data: StoreData) => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation) instrumentation.counters.mountTransitions++
}

const recordUnmount = (data: StoreData) => {
    const instrumentation = data.architectureInstrumentation
    if (instrumentation) instrumentation.counters.unmountTransitions++
}

const hasDirectSubscribers = (state: State, data: StoreData): boolean => {
    const subs = data.subscriptions.get(state)
    return !!subs && subs.size > 0
}

/** Does `state` itself carry a mount hook? */
const hasOwnMount = (state: State): boolean =>
    !!((state as InternalState).__valdresOnMount || state.onMount)

/**
 * "Mount-relevant" = a walk DOWN from `state` could find something to mount:
 * `state` itself has a mount hook, OR a strict descendant does (the cached
 * `mountInClosure` marker). When this is false, `mountTransitiveDeps` /
 * `unmountOrphanedDeps` are pure no-ops and can return before allocating.
 */
const hasMountInClosure = (state: State, data: StoreData): boolean =>
    hasOwnMount(state) || peekGraphNode(state, data)?.mountInClosure === true

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
            const parentNode = graphNodeFor(parent, data)
            if (parentNode.mountInClosure) continue
            // parent gains a mount-relevant child → it now has a mountable
            // descendant. Record the marker regardless of parent's own hook.
            parentNode.mountInClosure = true
            // Only ascend through parents that were not ALREADY mount-relevant
            // via their own hook — those had their ancestors marked when their
            // hook-bearing edges first formed, so re-ascending is redundant.
            if (!hasOwnMount(parent)) stack.push(parent)
        }
    }
}

/** Mark `state` and every existing dependent as potentially cyclic. */
const propagateCycleRiskUp = (state: State, data: StoreData) => {
    const seedNode = graphNodeFor(state, data)
    if (seedNode.cycleRisk) return
    seedNode.cycleRisk = true
    const stack: State[] = [state]
    while (stack.length > 0) {
        const current = stack.pop()!
        const parents = data.stateDependents.get(current)
        if (!parents) continue
        for (const parent of parents) {
            const parentNode = graphNodeFor(parent, data)
            if (parentNode.cycleRisk) continue
            parentNode.cycleRisk = true
            stack.push(parent)
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
 * Must be called for EVERY edge entering the live reverse graph (during
 * cold-to-live promotion and later live dependency additions), because the skip
 * in `mountTransitiveDeps` trusts the marker's no-false-negative invariant.
 */
export const noteDependencyAdded = (
    selector: State,
    dep: State,
    data: StoreData,
) => {
    // Any directed cycle must contain at least one edge that does not descend
    // through the stable selector-materialization order. Mark that edge's source
    // (and its existing dependents) as cycle-risky. A risky dependency also makes
    // the selector's closure risky. This is conservative and monotonic: false
    // positives are allowed; false negatives are not.
    // One record lookup each for `selector` and `dep` instead of one per field:
    // this runs per committed edge, and it used to read `dependencyOrder` twice,
    // `cycleRiskInClosure` once and `mountInClosure` twice.
    const selectorNode = graphNodeFor(selector, data)
    const depNode = peekGraphNode(dep, data)
    const selectorOrder = selectorNode.order
    const depOrder = depNode?.order ?? UNSET
    if (
        depNode?.cycleRisk === true ||
        selectorOrder === UNSET ||
        (isSelector(dep) && (depOrder === UNSET || depOrder >= selectorOrder))
    ) {
        propagateCycleRiskUp(selector, data)
    }

    if (!(hasOwnMount(dep) || depNode?.mountInClosure === true)) return
    if (selectorNode.mountInClosure) return
    selectorNode.mountInClosure = true
    // If `selector` already had its own hook it was already mount-relevant, so
    // its dependents were marked when their edges formed — no up-walk needed.
    if (!hasOwnMount(selector)) propagateMountMarkerUp(selector, data)
}

/**
 * Promote a selector's cached forward dependency closure into the iterable
 * reverse graph. Cold reads intentionally build only forward edges; the first
 * direct or transitive live consumer calls this before liveness propagation so
 * subsequent source writes can reach the whole subscribed selector closure.
 */
export const activateSelectorGraph = (root: State, data: StoreData) => {
    // Active dependencies dominate this call site: fresh live evaluation has
    // already marked each selector before committing the incoming edge, and a
    // second direct subscriber reaches the same graph again. Avoid allocating a
    // one-item traversal stack merely to discover that there is no work.
    // Before the first cold cache, every materialized selector graph is live by
    // construction, so even the active-marker lookup is redundant.
    if (!isSelector(root) || !data.coldSelectorCachesEnabled) return
    if (data.selectorGraphActive.has(root)) return
    // Promotion normally stops at the first already-live selector: a remounting
    // row re-promotes itself but reaches a shared aggregator that never left the
    // live graph. Filter those out at PUSH time so the frontier stays empty and
    // the traversal stack is never allocated, instead of pushing each one only
    // to discard it on pop. The pop-side check stays — it is what keeps a
    // diamond (one selector reached from two parents in the same walk) from
    // being processed twice.
    let stack: State[] | undefined
    let selector: State | undefined = root
    while (selector !== undefined) {
        if (!data.selectorGraphActive.has(selector)) {
            data.selectorGraphActive.add(selector)
            if (data.coldSelectorCachesEnabled) {
                data.coldSelectorCaches.delete(selector)
            }

            const dependencies = data.stateDependencies.get(selector)
            if (dependencies !== undefined) {
                noteDependencyGraphChanged(selector, data)
                for (const dependency of dependencies) {
                    addStateDependent(dependency, selector, data)
                    noteDependencyAdded(selector, dependency, data)
                    if (
                        isSelector(dependency) &&
                        !data.selectorGraphActive.has(dependency)
                    ) {
                        ;(stack ??= []).push(dependency)
                    }
                }
            }
        }
        selector = stack !== undefined ? stack.pop() : undefined
    }
}

/**
 * Cached liveness check. A state is "live" (transitively subscribed) iff it
 * has direct subscribers OR at least one of its dependents (selectors that
 * read it) is itself live. The "live dependent" contribution is tracked
 * incrementally in `data.liveDependentCount`, so this is O(1).
 */
export const isLive = (state: State, data: StoreData): boolean => {
    if (hasDirectSubscribers(state, data)) return true
    return (peekGraphNode(state, data)?.live ?? 0) > 0
}

/**
 * Propagate a "just became live" transition through the state's dependency
 * graph. For each dependency D of the state, the state itself counts as one
 * more live dependent of D. If that flips D from not-live to live, recurse.
 */
const propagateLive = (root: State, data: StoreData) => {
    const instrumentation = !IS_PROD
        ? data.architectureInstrumentation
        : undefined
    // The root's own edges are walked without a stack, and the stack is
    // allocated only if some dependency actually FLIPS to live. Most calls
    // don't cascade — a remount re-subscribes siblings that share an
    // already-live aggregator — so this keeps the common case allocation-free
    // instead of paying an array per call. `livenessWorkAllocations` is bumped
    // at the allocation itself, not on entry, so the counter keeps reporting
    // containers actually created.
    let stack: State[] | undefined
    let current: State | undefined = root
    while (current !== undefined) {
        const deps = data.stateDependencies.get(current)
        if (deps !== undefined) {
            for (const dep of deps) {
                if (instrumentation)
                    instrumentation.counters.livenessEdgeVisits++
                const depNode = graphNodeFor(dep, data)
                const prev = depNode.live
                depNode.live = prev + 1
                if (prev === 0 && !hasDirectSubscribers(dep, data)) {
                    if (stack === undefined) {
                        stack = []
                        if (instrumentation)
                            instrumentation.counters.livenessWorkAllocations++
                    }
                    stack.push(dep)
                }
            }
        }
        current = stack !== undefined ? stack.pop() : undefined
    }
}

/**
 * Propagate a "just became not-live" transition through the state's
 * dependency graph. Mirror of propagateLive.
 */
const propagateNotLive = (root: State, data: StoreData) => {
    const instrumentation = !IS_PROD
        ? data.architectureInstrumentation
        : undefined
    // Stack allocated only on an actual cascade — see propagateLive.
    let stack: State[] | undefined
    let current: State | undefined = root
    while (current !== undefined) {
        const deps = data.stateDependencies.get(current)
        if (deps !== undefined) {
            for (const dep of deps) {
                if (instrumentation)
                    instrumentation.counters.livenessEdgeVisits++
                // No record means the count is already 0, so there is nothing
                // to decrement and nothing to allocate.
                const depNode = peekGraphNode(dep, data)
                const prev = depNode?.live ?? 0
                if (prev > 0) depNode!.live = prev - 1
                if (prev === 1 && !hasDirectSubscribers(dep, data)) {
                    if (stack === undefined) {
                        stack = []
                        if (instrumentation)
                            instrumentation.counters.livenessWorkAllocations++
                    }
                    stack.push(dep)
                }
            }
        }
        current = stack !== undefined ? stack.pop() : undefined
    }
}

/**
 * Direct subscribers on `state` just transitioned from 0 → 1. If the state
 * wasn't already live via dependents, mark it live and propagate.
 */
export const onFirstDirectSubscriber = (state: State, data: StoreData) => {
    activateSelectorGraph(state, data)
    if (liveDependents(state, data) === 0) {
        propagateLive(state, data)
    }
}

/**
 * Direct subscribers on `state` just transitioned from 1 → 0. If the state
 * has no live dependents either, it transitions to not-live and we
 * propagate.
 */
export const onLastDirectSubscriber = (state: State, data: StoreData) => {
    if (liveDependents(state, data) === 0) {
        propagateNotLive(state, data)
    }
}

/**
 * A live selector gained dependency `dep`. Register the contribution to
 * dep's liveDependentCount; if dep transitions to live, propagate.
 */
export const onLiveDependencyAdded = (dep: State, data: StoreData) => {
    activateSelectorGraph(dep, data)
    const node = graphNodeFor(dep, data)
    const prev = node.live
    node.live = prev + 1
    if (prev === 0 && !hasDirectSubscribers(dep, data)) {
        propagateLive(dep, data)
    }
}

/**
 * A live selector lost dependency `dep`. Decrement and propagate not-live
 * if the contribution was the last one keeping dep alive.
 */
export const onLiveDependencyRemoved = (dep: State, data: StoreData) => {
    // See propagateNotLive: absent record == count 0, so a decrement is a no-op.
    const node = peekGraphNode(dep, data)
    const prev = node?.live ?? 0
    if (prev > 0) node!.live = prev - 1
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
 * seeds' closure; an `onPath` (gray) set detects a back-edge, while fully explored
 * acyclic subgraphs are memoized against the current topology generation. Only
 * selectors are keyed in `stateDependencies`; atoms and atom-family members are
 * graph sinks (no out-edges), so a region of pure atom deps returns false in
 * O(seeds).
 * (selectorFamily members ARE selectors and do have out-edges.)
 */
const seedClosureHasCycle = (
    seed: State,
    data: StoreData,
    graphVersion: number,
): boolean => {
    // A prior scan at this topology version proved the full downward closure
    // acyclic. Orphan teardown only deletes edges, so the proof stays valid
    // across every sibling unsubscribe in the burst.
    if (peekGraphNode(seed, data)?.acyclicAt === graphVersion) return false

    const workspace = acquireLivenessWorkspace(data)
    const onPath = ensureOnPath(workspace, data)
    const stack = workspace.dfs
    // Explicit stack of frames: { node, iterator over its deps }. A frame is
    // pushed onto `onPath` when entered. Once its deps are exhausted, its whole
    // closure is proven acyclic at this graph version. Encountering an `onPath`
    // node is a back-edge. Positive results are never cached because a later
    // teardown edge deletion could break the cycle without bumping the version.
    stack.push({
        node: seed,
        it: (data.stateDependencies.get(seed) ?? EMPTY).values(),
    })
    onPath.add(seed)
    try {
        while (stack.length > 0) {
            const frame = stack[stack.length - 1]!
            const next = frame.it.next()
            if (next.done) {
                onPath.delete(frame.node)
                graphNodeFor(frame.node, data).acyclicAt = graphVersion
                stack.pop()
                continue
            }
            const dep = next.value as State
            if (!IS_PROD) recordLivenessEdge(data)
            if (onPath.has(dep)) return true // back-edge → cycle
            if (peekGraphNode(dep, data)?.acyclicAt === graphVersion) continue
            onPath.add(dep)
            stack.push({
                node: dep,
                it: (data.stateDependencies.get(dep) ?? EMPTY).values(),
            })
            noteLivenessWorkspaceSize(workspace)
        }
        return false
    } finally {
        releaseLivenessWorkspace(workspace)
    }
}

export const regionHasCycle = (
    seeds: Set<State> | State,
    data: StoreData,
): boolean => {
    const graphVersion = data.dependencyGraphVersion
    if (seeds instanceof Set) {
        for (const seed of seeds) {
            if (seedClosureHasCycle(seed, data, graphVersion)) return true
        }
        return false
    }
    return seedClosureHasCycle(seeds, data, graphVersion)
}

/**
 * The materialization-order marker is conservative and propagated upward on
 * every dependency addition. Therefore, if none of these seeds is marked, no
 * directed cycle can exist anywhere in their downward closures.
 */
const seededRegionMayHaveCycle = (seeds: Set<State>, data: StoreData) => {
    for (const seed of seeds) {
        if (peekGraphNode(seed, data)?.cycleRisk === true) return true
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
        (lazyArmed ||
            (removalArmed &&
                seededRegionMayHaveCycle(seeds, data) &&
                regionHasCycle(seeds, data)))
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
 *
 * TWO CALLING MODES, deliberately distinct. There are exactly three call sites
 * and they do NOT all go through the ownership token:
 *
 *  - OWNER-DEFERRED (`propagateSelectorUpdates` in propagateUpdatedAtoms.ts, and
 *    the store read path in storeFromStoreData.ts). Both bracket their work with
 *    `beginLivenessPass` / `endLivenessPass`: a nested pass returns false from
 *    begin, contributes its seeds to the in-flight owner's collector, and
 *    reconciles nothing. The OUTERMOST owner reconciles the accumulated region
 *    once, after releasing the token. `seeds` here is a whole pass's churn.
 *
 *  - IMMEDIATE (`unsubscribe.ts`). It does NOT consult `livenessPassActive` at
 *    all: it reconciles its own single seed synchronously, unconditionally, even
 *    when called from inside an owned pass (an unsubscribe from a subscriber
 *    callback). That is intentional, not an oversight — `onUnmount` semantics
 *    are eager, so a last-subscriber removal on a cyclic region must tear that
 *    region down before `unsubscribe` returns rather than at some enclosing
 *    pass's boundary. It also does not TAKE ownership, so it cannot steal the
 *    token from an in-flight pass or cause a second one; livenessPassOwnership
 *    .test.ts pins that ("unsubscribing from inside an owned pass leaves
 *    ownership intact").
 *
 * Do not route unsubscribe through the ownership gate to make the three sites
 * uniform. Deferring its reconcile to an enclosing owner would delay unmount
 * past the unsubscribe call and change observable `onUnmount` timing — a
 * behavioural change that belongs in its own PR with its own coverage, not in a
 * refactor that consolidates the call sites for tidiness.
 */
export const reconcileLivenessAfterChurn = (
    seeds: Set<State>,
    data: StoreData,
) => {
    const workspace = acquireLivenessWorkspace(data)
    const region = ensureRegion(workspace, data)
    const live = ensureLive(workspace, data)
    const wasLive = ensureWasLive(workspace, data)
    const mountVisited = ensureMountVisited(workspace, data)
    const unmountVisited = ensureUnmountVisited(workspace, data)
    const stack = workspace.stack
    const work = workspace.ordered
    try {
        // 1. region = downward dependency closure of the seeds.
        for (const seed of seeds) stack.push(seed)
        noteLivenessWorkspaceSize(workspace)
        while (stack.length > 0) {
            const s = stack.pop()!
            if (region.has(s)) continue
            region.add(s)
            const deps = data.stateDependencies.get(s)
            if (deps)
                for (const d of deps) {
                    if (!IS_PROD) recordLivenessEdge(data)
                    if (!region.has(d)) stack.push(d)
                }
            noteLivenessWorkspaceSize(workspace)
        }

        // 2. Ground-truth liveness for the region. Seed from direct subscribers
        //    and from dependents OUTSIDE the region (their liveness is unaffected
        //    by this churn, so the cached isLive() is authoritative). Then push
        //    liveness DOWN: a live state's dependencies gain a live dependent.
        for (const D of region) {
            let isit = hasDirectSubscribers(D, data)
            if (!isit) {
                const dependents = data.stateDependents.get(D)
                if (dependents) {
                    for (const T of dependents) {
                        if (!IS_PROD) recordLivenessEdge(data)
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
                noteLivenessWorkspaceSize(workspace)
            }
        }
        while (work.length > 0) {
            const T = work.pop()!
            const deps = data.stateDependencies.get(T)
            if (!deps) continue
            for (const D of deps) {
                if (!IS_PROD) recordLivenessEdge(data)
                if (region.has(D) && !live.has(D)) {
                    live.add(D)
                    work.push(D)
                    noteLivenessWorkspaceSize(workspace)
                }
            }
        }

        // 3. Recompute counts from ground truth, snapshotting prior liveness so
        //    mount/unmount only run on genuine transitions (idempotent).
        for (const D of region) wasLive.set(D, isLive(D, data))
        for (const D of region) {
            const dependents = data.stateDependents.get(D)
            let count = 0
            if (dependents) {
                for (const T of dependents) {
                    if (!IS_PROD) recordLivenessEdge(data)
                    if (region.has(T) ? live.has(T) : isLive(T, data)) count++
                }
            }
            // liveDependentCount never stores 0 (entries are deleted at <= 0),
            // so a missing entry IS count 0 — only touch on a genuine change.
            // Peek first: a region member whose reconciled count already
            // matches — including the common 0-to-0 case for a node that never
            // needed a record — must not be given one.
            const existing = peekGraphNode(D, data)
            if (count === (existing?.live ?? 0)) continue
            ;(existing ?? graphNodeFor(D, data)).live = count > 0 ? count : 0
        }
        // Share one visited set across all mounts and a different set across all
        // unmounts. They cannot be shared with each other: a node skipped by one
        // transition direction must remain reachable from the other.
        for (const D of region) {
            const now = live.has(D)
            if (now && !wasLive.get(D))
                mountTransitiveDeps(D, data, mountVisited)
            else if (!now && wasLive.get(D))
                unmountOrphanedDeps(D, data, unmountVisited)
        }
    } finally {
        releaseLivenessWorkspace(workspace)
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
    const onMountFn = (state as InternalState).__valdresOnMount ?? state.onMount
    if (!onMountFn || data.mounts.has(state)) return
    // Mark as mounted BEFORE calling onMountFn to prevent reentrant mounts
    // (onMount may call setSelf which triggers propagation and dep changes)
    const mountEntry: { cleanup?: () => void } = {}
    data.mounts.set(state, mountEntry)
    if (!trackStoreMount(data, state)) {
        data.mounts.delete(state)
        return
    }
    const store = getStoreRuntime(data)
    try {
        const result = onMountFn(store, state)
        if (typeof result === "function") {
            // onMount may dispose its own store re-entrantly. Disposal sees the
            // provisional mount entry and removes it before the callback
            // returns, so run a cleanup returned afterwards immediately rather
            // than stranding a resource outside the lifecycle ledger.
            if (
                isStoreDisposed(data) ||
                data.mounts.get(state) !== mountEntry
            ) {
                result()
            } else {
                mountEntry.cleanup = result
            }
        }
        if (
            !IS_PROD &&
            data.architectureInstrumentation &&
            data.mounts.get(state) === mountEntry
        ) {
            recordMount(data)
        }
    } catch (error) {
        if (data.mounts.get(state) === mountEntry) data.mounts.delete(state)
        untrackStoreMount(data, state)
        throw error
    }
}

/**
 * Unmount a single atom: remove it from data.mounts and call its cleanup.
 * No-op if the atom is not mounted.
 */
export const unmountAtom = (state: State, data: StoreData) => {
    const mount = data.mounts.get(state)
    if (!mount) {
        untrackStoreMount(data, state)
        return
    }
    data.mounts.delete(state)
    untrackStoreMount(data, state)
    if (!IS_PROD && data.architectureInstrumentation) recordUnmount(data)
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
    // Sound because mount hooks are present before a state is first used (the
    // AtomOnMount contract), so the marker is populated as dependency edges form
    // and never has a false negative.
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
    const instrumentation = !IS_PROD
        ? data.architectureInstrumentation
        : undefined
    if (instrumentation)
        instrumentation.counters.livenessWorkAllocations += visited ? 1 : 2
    while (stack.length > 0) {
        const current = stack.pop()!
        if (seen.has(current)) continue
        seen.add(current)
        if ((current as InternalState).__valdresOnMount || current.onMount) {
            if (current !== state) sawMountDescendant = true
            try {
                mountAtom(current, data)
            } catch (error) {
                if (!firstError) firstError = { value: error }
            }
        }
        const deps = data.stateDependencies.get(current)
        if (deps) {
            // Dependencies are recorded in read order. Push them in reverse so
            // the LIFO traversal mounts siblings in that same observable order.
            const orderedDeps = Array.from(deps) as State[]
            if (instrumentation)
                instrumentation.counters.livenessWorkAllocations++
            for (let i = orderedDeps.length - 1; i >= 0; i--) {
                const dep = orderedDeps[i]!
                if (instrumentation) instrumentation.counters.mountEdgeVisits++
                if (!seen.has(dep)) stack.push(dep)
            }
        }
    }
    if (canRecomputeMarker && !sawMountDescendant) {
        const node = peekGraphNode(state, data)
        if (node !== undefined) node.mountInClosure = false
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
    // Fast path: nothing mountable here or anywhere reachable below means nothing
    // could be mounted beneath it either. See mountTransitiveDeps for soundness.
    if (!hasMountInClosure(state, data)) return
    // See mountTransitiveDeps: a standalone walk can clear a now-stale marker.
    const canRecomputeMarker = visited === undefined
    let sawMountDescendant = false
    const seen = visited ?? new Set<State>()
    let firstError: { value: unknown } | null = null
    const stack: State[] = [state]
    const instrumentation = !IS_PROD
        ? data.architectureInstrumentation
        : undefined
    if (instrumentation)
        instrumentation.counters.livenessWorkAllocations += visited ? 1 : 2
    while (stack.length > 0) {
        const current = stack.pop()!
        if (seen.has(current)) continue
        seen.add(current)
        if ((current as InternalState).__valdresOnMount || current.onMount) {
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
                if (instrumentation) instrumentation.counters.mountEdgeVisits++
                if (!seen.has(dep)) stack.push(dep)
            }
        }
    }
    if (canRecomputeMarker && !sawMountDescendant) {
        const node = peekGraphNode(state, data)
        if (node !== undefined) node.mountInClosure = false
    }
    if (firstError) {
        throw firstError.value
    }
}
