import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { cleanupOrphanedDeps } from "./cleanupOrphanedDeps"

/**
 * Drain this store's queued orphan roots synchronously. Public store operations
 * call this first so microtask batching does not change their observable cache
 * semantics.
 */
export const flushPendingOrphanCleanup = (data: StoreData) => {
    const pending = data.pendingOrphanCleanup as Set<State> | undefined
    if (!pending) return
    data.pendingOrphanCleanup = undefined
    for (const state of pending) cleanupOrphanedDeps(state, data)
}
