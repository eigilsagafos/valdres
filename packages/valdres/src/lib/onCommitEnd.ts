import type { StoreData } from "../types/StoreData"

/** Global count of `onCommitEnd` listeners across every store — the cheap
 *  "is anyone listening" gate, mirroring `changeListenerRegistry`. Every commit
 *  boundary checks `count !== 0` first, so with no listener anywhere (the
 *  common case) a commit pays a single property read and does no tracking and
 *  no allocation. */
export const commitEndRegistry = { count: 0 }

const rootOf = (data: StoreData): StoreData => {
    let root = data
    while (root.parent) root = root.parent
    return root
}

/** Open a commit boundary for the store tree `data` belongs to and return the
 *  tree's root (whose depth counter was incremented). Only called when
 *  `commitEndRegistry.count !== 0`; the caller MUST balance with `endCommit`
 *  on every path (including throws) using the returned root, so a listener
 *  unsubscribing mid-commit can't strand the depth counter. */
export const beginCommit = (data: StoreData): StoreData => {
    const root = rootOf(data)
    root.commitDepth = (root.commitDepth ?? 0) + 1
    return root
}

/** Close a commit boundary opened by `beginCommit`. When this closes the
 *  OUTERMOST boundary (depth returns to 0), fire the tree's `onCommitEnd`
 *  listeners exactly once — strictly after every subscriber callback of the
 *  commit, and after `store.onChange`. Nested boundaries (a subscriber or onSet
 *  hook writing during the commit) just decrement: their writes coalesce into
 *  the outermost commit's single notification.
 *
 *  Every listener fires even if one throws; the first error is rethrown unless
 *  `swallowErrors` — used when the commit itself is already throwing, so a
 *  listener error never masks the original failure (same contract as the
 *  onChange flush in Transaction.commit). */
export const endCommit = (root: StoreData, swallowErrors: boolean) => {
    if ((root.commitDepth = root.commitDepth! - 1) !== 0) return
    const listeners = root.commitEndListeners
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
    const root = rootOf(data)
    let listeners = root.commitEndListeners
    if (!listeners) {
        listeners = new Set()
        root.commitEndListeners = listeners
    }
    // Set semantics make re-registering the same callback a no-op; only count
    // (and hand out an active unsubscribe for) a callback we actually added.
    if (listeners.has(callback)) return () => {}
    listeners.add(callback)
    commitEndRegistry.count++
    let active = true
    return () => {
        if (!active) return
        active = false
        const current = root.commitEndListeners
        if (current?.delete(callback)) {
            commitEndRegistry.count--
            // Drop the empty set so an idle tree holds no listener allocation.
            if (current.size === 0) root.commitEndListeners = undefined
        }
    }
}
