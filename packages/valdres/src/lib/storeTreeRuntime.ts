import type { ColdSelectorCache, StoreData } from "../types/StoreData"
import type { TransactionContext } from "./transaction"

/**
 * State owned by a store TREE rather than by one store: created with the root
 * and shared by reference with every scope beneath it (`createStoreData`
 * assigns `parent.tree` verbatim). One object per tree, allocated eagerly with
 * every field present so its hidden class is fixed at construction — a lazily
 * added or `??=`'d field would reintroduce the shape transition this sidecar
 * exists to remove.
 *
 * Why these fields and not others: each one is either logically single-valued
 * for the whole tree (the revision clock, the commit-end registry) or was
 * previously stored "root stores only" on every `StoreData` and resolved by
 * walking `parent` on each access. Per-store hot tables (`values`, the graph
 * planes, subscriptions) deliberately stay on `StoreData`; grouping them here
 * would add a dereference to the atom get/set path for no ownership gain.
 *
 * Write ownership:
 *   root                     lib/createStoreData.ts (construction only)
 *   revision / revisionEnabled / trackedRevisions
 *                            lib/stateRevisions.ts, lib/setValueInData.ts
 *   coldValidationDepth / coldValidationBaseRevision / coldValidationProvisional
 *                            lib/getState.ts (the validation pass owner)
 *   coldValidationPass       lib/getState.ts opens and retires the pass; the
 *                            paths that END one early because something changed
 *                            outside the walk go through the two helpers in
 *                            lib/stateRevisions.ts, called from there plus
 *                            lib/setValueInData.ts, lib/graph/runtime.ts,
 *                            lib/initSelector.ts and
 *                            lib/asyncDependencyTracking.ts
 *   commitDepth / commitDidWork
 *                            lib/onCommitEnd.ts (beginCommit/endCommit only —
 *                            disposal must never reset either; a scope disposed
 *                            mid-commit would drive the live tree negative)
 *   commitEndListeners       lib/onCommitEnd.ts, plus root-only teardown in
 *                            lib/disposeStoreData.ts
 *   pendingBatch / pendingBatchCleanup
 *                            lib/storeFromStoreData.ts
 *
 * Reads are unrestricted; every module may read `data.tree.*` freely.
 *
 * Note that owning `commitEndListeners` here does NOT make the process-global
 * `commitEndRegistry` counter redundant. That counter is the coarse "is anyone
 * anywhere listening" admission gate, and it is read before the commit forest
 * is known — a commit can span trees through global-atom fan-out, so the origin
 * tree's own listener set is not a sound substitute (see lib/onCommitEnd.ts).
 */
export type StoreTreeRuntime = {
    /** The tree's root store. Replaces walking `parent` to the top on every
     *  commit boundary; one tree ⇔ one root, so tree identity also serves as
     *  the root-dedupe key when a commit forest spans stores. */
    root: StoreData
    /** Monotonic value-revision clock for the tree. Enabled lazily by the first
     *  cold selector so atom-only stores never maintain revision entries. */
    revision: number
    revisionEnabled: boolean
    /** States directly referenced by at least one cold cache. Weak membership
     *  lets writes skip revision-map churn for unrelated states without
     *  retaining either side of the dependency. */
    trackedRevisions: WeakSet<WeakKey> | undefined
    /** The cold-cache validation pass: re-entrancy depth (the OUTERMOST entry
     *  owns the pass, nested ones join it), the pass id (from 1, so the `0` a
     *  fresh `ColdSelectorCache` carries never matches a live pass), and
     *  `revision` as of the last pass's end (`-1` before the first). Unlike
     *  `revision`, the id does NOT move for the materializations a validation
     *  walk performs itself. Rationale in lib/getState.ts. */
    coldValidationDepth: number
    coldValidationPass: number
    coldValidationBaseRevision: number
    /** Provisional freshness answers the cycle guard handed out in the pass in
     *  flight. Non-zero blocks every freshness record for the rest of it — see
     *  lib/getState.ts, `isColdSelectorCacheFresh`. */
    coldValidationProvisional: number
    /** Set when a source changed while a validation walk was active, so no frame
     *  of that walk may record freshness: its conclusions were reached against
     *  revisions that no longer hold. Cleared with the outermost pass. */
    coldValidationPoisoned: boolean
    /** Re-entrancy depth of in-flight commit boundaries for this tree.
     *  Listeners fire when the OUTERMOST boundary closes, so writes performed
     *  by a subscriber coalesce into one notification. */
    commitDepth: number
    /** Whether anything inside the currently open boundary chain actually
     *  committed. A boundary whose write phase runs INSIDE it (reset, a
     *  transaction commit) has to open before it can know, so it reports the
     *  answer on close instead; a no-op then closes silently. Nested boundaries
     *  record their own work here, so a subscriber writing during delivery
     *  still produces exactly one notification. Reset when the outermost
     *  boundary closes. */
    commitDidWork: boolean
    /** Commit-end listeners for the whole tree: a listener registered through
     *  any store fires for a commit originating in any store of that tree.
     *  Undefined until the first listener and reset to undefined when the last
     *  one leaves, so an idle tree holds no allocation. */
    commitEndListeners: Set<() => void> | undefined
    /** The implicit microtask batch shared by the root and every scope. */
    pendingBatch: TransactionContext | null
    /** Root-store lifecycle cleanup for `pendingBatch`. */
    pendingBatchCleanup: (() => void) | undefined
}

/** Is `cache` still known-current by virtue of the tree's validation pass?
 *  Shared by the store-boundary read and the read primitive — see the note in
 *  the body for why it must be exactly one predicate. */
export const coldCacheIsCurrentInPass = (
    cache: ColdSelectorCache,
    tree: StoreTreeRuntime,
): boolean =>
    // Three things have to hold. A non-validatable snapshot is never current,
    // whatever pass stamped it. The snapshot must carry the CURRENT pass id. And
    // that pass must still be authoritative — true only while one is in flight
    // (the outermost entry has already advanced the id if the clock moved), or
    // after one ended with the clock still where it left it. Once a write moves
    // `revision` past `coldValidationBaseRevision` every stamp from that pass is
    // void and the next outermost entry allocates a new id.
    //
    // Deliberately ONE predicate for lib/storeFromStoreData.ts and
    // lib/getState.ts: a boundary that answered this differently from the
    // primitive behind it would serve a value the primitive would have
    // re-derived. src/selector.test.ts ("cold cache skips re-evaluation after an
    // unrelated write") is what makes the third term load-bearing.
    cache.validatedAt >= 0 &&
    cache.validatedInPass === tree.coldValidationPass &&
    (tree.coldValidationDepth > 0 ||
        tree.coldValidationBaseRevision === tree.revision)

/**
 * May the caller record freshness for a cold snapshot right now?
 *
 * A record is a CLAIM that the snapshot matches what its dependencies hold. Two
 * things void the evidence for that claim, and both are properties of the WALK
 * rather than of the snapshot, which is why this is asked here and not inferred
 * at each stamp site:
 *
 *  - POISONED: a source changed while the walk was active (user code re-entering
 *    the store from a selector body, a lazy default resolving). Every frame of
 *    that walk read dependency revisions that no longer hold, so an enclosing
 *    frame stamping AFTER the change would launder it — and because the change
 *    retired the pass id, it would stamp into the NEW id and be believed across
 *    later reads. That is how `root` came to serve 10 while the same store served
 *    the `observer` it is defined as reading as 70.
 *  - PROVISIONAL: the walk leaned on the cycle guard's "assume fresh" answer,
 *    which is a guess. Suppressing only the pass stamp is not enough — a later
 *    read still accepts the guess through `validatedAt` whenever the clock has
 *    not moved since, which let a dynamic cycle latch A === 5 alongside B === 6
 *    though A's body is `B + 1`.
 *
 * Outside a walk there is no walk to distrust, so an ordinary cold read records
 * normally.
 */
export const coldValidationMayRecord = (tree: StoreTreeRuntime): boolean =>
    tree.coldValidationDepth === 0 ||
    (!tree.coldValidationPoisoned && tree.coldValidationProvisional === 0)

/** Build the tree sidecar for a new ROOT store. Scopes never call this — they
 *  inherit `parent.tree` by reference. */
export const createStoreTreeRuntime = (root: StoreData): StoreTreeRuntime => ({
    root,
    revision: 0,
    revisionEnabled: false,
    trackedRevisions: undefined,
    coldValidationDepth: 0,
    coldValidationPass: 1,
    coldValidationBaseRevision: -1,
    coldValidationProvisional: 0,
    coldValidationPoisoned: false,
    commitDepth: 0,
    commitDidWork: false,
    commitEndListeners: undefined,
    pendingBatch: null,
    pendingBatchCleanup: undefined,
})
