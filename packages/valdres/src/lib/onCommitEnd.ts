import type { CommitBoundary } from "../types/CommitPlan"
import type { StoreData } from "../types/StoreData"
import type { StoreTreeRuntime } from "./storeTreeRuntime"
import { trackStoreCleanup, untrackStoreCleanup } from "./storeLifecycle"

/** Global count of `onCommitEnd` listeners across every store — the cheap
 *  "is anyone listening" gate, mirroring `changeListenerRegistry`. Every commit
 *  boundary checks `count !== 0` first, so with no listener anywhere (the
 *  common case) a commit pays a single property read and does no tracking and
 *  no allocation.
 *
 *  The listener set and depth counter themselves are tree-owned
 *  (`StoreTreeRuntime`), but this counter deliberately is NOT: it is read
 *  before the commit forest is known, and a commit can span trees through
 *  global-atom fan-out, so the origin tree's own set is not a sound substitute.
 *  Narrowing this to per-tree admission would also change which boundaries open
 *  for a listener registered mid-commit. */
export const commitEndRegistry = { count: 0 }

/** True iff the store tree containing `data` has a commit-end listener. The
 * process-wide count keeps the common zero-listener path to one property read;
 * only a process with some listener pays the tree dereference. */
export const hasCommitEndListener = (data: StoreData): boolean =>
    commitEndRegistry.count !== 0 &&
    (data.tree.commitEndListeners?.size ?? 0) !== 0

/** Open a commit boundary for the store tree `data` belongs to and return that
 *  tree (whose depth counter was incremented). Only called when
 *  `commitEndRegistry.count !== 0`; the caller MUST balance with `endCommit`
 *  on every path (including throws) using the returned tree, so a listener
 *  unsubscribing mid-commit can't strand the depth counter. */
export const beginCommit = (data: StoreData): StoreTreeRuntime => {
    const tree = data.tree
    tree.commitDepth++
    return tree
}

/** Close a commit boundary opened by `beginCommit`. When this closes the
 *  OUTERMOST boundary (depth returns to 0), fire the tree's `onCommitEnd`
 *  listeners exactly once — strictly after every subscriber callback of the
 *  commit, and after `store.onChange`. Nested boundaries (a subscriber or onSet
 *  hook writing during the commit) just decrement: their writes coalesce into
 *  the outermost commit's single notification.
 *
 *  `didWork` is false when the closing boundary's own commit turned out to be a
 *  no-op — a reset to the value already held, a transaction whose every write
 *  was value-equal. Such a boundary MUST be opened before its write phase can
 *  answer the question (the write phase runs inside it), so it answers on close
 *  instead, and a tree with no work anywhere in the chain notifies nobody. That
 *  makes `onCommitEnd` consistent with the no-op `set` and no-op `unset` it
 *  already stays silent for. Every other caller opens its boundary around work
 *  it has already committed to doing, hence the default.
 *
 *  Every listener fires even if one throws; the first error is rethrown unless
 *  `swallowErrors` — used when the commit itself is already throwing, so a
 *  listener error never masks the original failure (same contract as the
 *  onChange flush in the transaction commit pipeline). */
export const endCommit = (
    tree: StoreTreeRuntime,
    swallowErrors: boolean,
    didWork = true,
) => {
    if (didWork) tree.commitDidWork = true
    if (--tree.commitDepth !== 0) return
    const committed = tree.commitDidWork
    tree.commitDidWork = false
    if (!committed) return
    const listeners = tree.commitEndListeners
    // The size re-check is the backstop for the `undefined ⟺ empty` invariant
    // the registration path maintains below.
    if (listeners === undefined || listeners.size === 0) return
    let firstError: unknown
    let hasError = false
    // Snapshot so a listener that unsubscribes (or registers another listener)
    // mid-fire doesn't affect this commit's delivery.
    for (const listener of [...listeners]) {
        try {
            listener()
        } catch (error) {
            if (!hasError) {
                firstError = error
                hasError = true
            }
        }
    }
    if (hasError && !swallowErrors) throw firstError
}

/** The one paired boundary every engine-sequenced commit uses. Begin and end
 *  ship together as a single frozen capability, so a plan can neither open a
 *  boundary it won't close nor claim a close it never opened. Module-static:
 *  taking a boundary costs no allocation. */
const COMMIT_END_BOUNDARY: CommitBoundary = Object.freeze({
    begin: beginCommit,
    end: endCommit,
})

/** The outer commit boundary a standalone local operation should carry, or
 *  undefined when no `onCommitEnd` listener exists anywhere — a single counter
 *  read on the common path. */
export const activeCommitBoundary = (): CommitBoundary | undefined =>
    commitEndRegistry.count === 0 ? undefined : COMMIT_END_BOUNDARY

/** Register a commit-end listener on `data`'s store tree — the implementation
 *  behind `store.onCommitEnd`. Listeners live on the tree's ROOT store: a
 *  commit anywhere in the tree (root or any scope, wherever it originated)
 *  fires every listener registered through any store of that tree. That is the
 *  delegation an update-coalescing consumer needs — a root write propagates
 *  into scopes and a scope write notifies scope subscribers, and both must end
 *  with the same flush. Returns an unsubscribe function. */
export const onCommitEnd = (
    callback: () => void,
    data: StoreData,
): (() => void) => {
    const tree = data.tree
    let listeners = tree.commitEndListeners
    if (!listeners) {
        listeners = new Set()
        tree.commitEndListeners = listeners
    }
    // Set semantics make re-registering the same callback a no-op; only count
    // (and hand out an active unsubscribe for) a callback we actually added.
    if (listeners.has(callback)) return () => {}
    listeners.add(callback)
    commitEndRegistry.count++
    let active = true
    const cleanup = () => {
        if (!active) return
        active = false
        untrackStoreCleanup(data, cleanup)
        const current = tree.commitEndListeners
        if (current?.delete(callback)) {
            commitEndRegistry.count--
            // Drop the empty set so an idle tree holds no listener allocation.
            if (current.size === 0) tree.commitEndListeners = undefined
        }
    }
    trackStoreCleanup(data, cleanup)
    return cleanup
}
