/**
 * The dependency-graph runtime: the single owner of every WRITE to the graph
 * tables on StoreData —
 *
 *   stateDependencies / stateDependents      forward/reverse edges + replacement
 *   selectorGraphActive                      cold→live promotion markers
 *   inheritedDependencyBranches(+Keys)       scope-branch registration
 *   liveDependentCount / mounts /            liveness + mount reachability, and
 *     mountInClosure, livenessPassActive/      the liveness-pass scratch
 *     livenessSeeds/livenessRemovalArmed/
 *     livenessLazyArmed
 *   dependencyOrder / nextDependencyOrder /  cycle metadata: stable order,
 *     dependencyGraphVersion /                 topology generation, risk marker,
 *     cycleRiskInClosure /                     memoized acyclic proofs
 *     acyclicDependencyVersion
 *   orphanCleanupVersion /                   orphan-edge cleanup plane
 *     pendingOrphanCleanup /
 *     orphanCleanupScheduled
 *
 * Non-graph modules may READ these tables freely (hot paths depend on it) and
 * may compare `pendingOrphanCleanup` against DISPOSED_STORE_PENDING, but every
 * write goes through a function exported from this facade — enforced by
 * test/import-cycles/graphBoundary.test.ts, which also pins that graph modules
 * import only graph siblings plus a fixed leaf allowlist, keeping this cluster
 * outside every import cycle (the commitEngine "leaf by injection" pattern).
 * The one deliberate carve-out is the transaction overlay
 * (SelectorEvaluationRuntime): its private forward map mirrors this shape but
 * is evaluation-session state owned by the draft, never the committed graph.
 *
 * Scheduler and multi-container cyclic-liveness worklists live in the leaf
 * `workspace` module, weakly keyed by StoreData rather than stored on it. At
 * most four frames per store are pooled for re-entrant user code; every release
 * clears strong state references and drops backing containers above 1,024
 * entries. Measured-faster single-array count and mount walks remain local.
 *
 * Invariants owned here:
 * - Edge CONSTRUCTION bumps dependencyGraphVersion (noteDependencyGraphChanged);
 *   orphan-teardown edge DELETION deliberately does not, preserving memoized
 *   acyclic proofs across an unsubscribe burst. Do not "fix" the asymmetry.
 *   (The async-deps reconcile bumps once per reconcile — existing behavior.)
 * - Phase model for consumers: after an install* call the edge TOPOLOGY
 *   (symmetric edges, order, scope branches) is consistent, but liveness and
 *   mounts may still be pending until applyLiveDependencyDiff or the owning
 *   liveness pass (endLivenessPass + reconcileLivenessAfterChurn) settles
 *   them; full store invariants hold at those settled boundaries, after
 *   reconcileAsyncDeps, and after completed disposal.
 *
 * Sanctioned cross-plane effects (the boundary is "one writing owner for
 * graph tables", not "graph code touches nothing else"):
 * - activateSelectorGraph deletes coldSelectorCaches entries — cold→live
 *   promotion consumes the cold plane.
 * - installLateDependency invalidates a cold cache (validatedAt = -1) when a
 *   new async edge desynchronizes it.
 * - cleanupOrphanedDeps deletes orphaned states' entries from values,
 *   coldSelectorCaches, and latestEvalContext, and aborts + untracks their
 *   controllers: delete-only teardown of the planes it orphans, never inserts.
 * - The store facade for user onMount hooks resolves through the leaf
 *   getStoreRuntime slot; iterable mount ledgers go through storeLifecycle.
 *
 * A follow-up may split StoreData into a read-only view for ordinary modules
 * and a mutable graph-only type; today the static boundary test carries that
 * guarantee without retyping every module.
 */

export {
    beginLivenessPass,
    endLivenessPass,
    isLive,
    mountAtom,
    mountTransitiveDeps,
    onFirstDirectSubscriber,
    onLastDirectSubscriber,
    reconcileLivenessAfterChurn,
    regionHasCycle,
    unmountAtom,
    unmountOrphanedDeps,
} from "./mountAtom"
export {
    detachInheritedDependencyBranches,
    hasInheritedDependencyBranches,
    refreshInheritedDependencyBranch,
} from "./inheritedDependencyBranches"
export { queueOrphanCleanup } from "./queueOrphanCleanup"
export { flushPendingOrphanCleanup } from "./flushPendingOrphanCleanup"
export {
    acquireEvaluationOutcome,
    createEvaluationOutcome,
    releaseEvaluationOutcome,
    type EvaluationOutcome,
} from "./evaluationOutcome"
export {
    applyLiveDependencyDiff,
    clearStaleSelectorActivation,
    dropQueuedOrphanWork,
    installEvaluationDeps,
    installEvaluationDepsLiveOnly,
    installLateDependency,
    markSelectorGraphActive,
    reconcileAsyncDeps,
    resetLivenessScratch,
    rollbackSelectorActivation,
    sealGraphForDisposal,
    settleLateDependency,
} from "./runtime"
export {
    scheduleSelectors,
    SCHEDULE_CHANGED,
    SCHEDULE_GRAPH_CHANGED,
} from "./scheduler"
