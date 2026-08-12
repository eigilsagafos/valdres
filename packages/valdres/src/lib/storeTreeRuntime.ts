import type { StoreData } from "../types/StoreData"
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

/** Build the tree sidecar for a new ROOT store. Scopes never call this — they
 *  inherit `parent.tree` by reference. */
export const createStoreTreeRuntime = (root: StoreData): StoreTreeRuntime => ({
    root,
    revision: 0,
    revisionEnabled: false,
    trackedRevisions: undefined,
    commitDepth: 0,
    commitDidWork: false,
    commitEndListeners: undefined,
    pendingBatch: null,
    pendingBatchCleanup: undefined,
})
