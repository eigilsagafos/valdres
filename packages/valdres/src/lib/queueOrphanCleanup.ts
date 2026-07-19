import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { flushPendingOrphanCleanup } from "./flushPendingOrphanCleanup"
import { isStoreDisposed } from "./storeLifecycle"

/**
 * Batch orphan graph/value cleanup across a synchronous unsubscribe burst.
 * This one-microtask delay is intentional: lifecycle cleanup already ran
 * synchronously, and every public store operation drains this queue before it
 * can observe or mutate selector caches.
 */
export const queueOrphanCleanup = (state: State, data: StoreData) => {
    if (isStoreDisposed(data)) return
    // Plain atoms with no dependents have no dependency edges or selector cache
    // for the orphan sweep to remove. Avoid allocating a Set and scheduling a
    // microtask on the common subscribe/unsubscribe fast path.
    if (
        !data.stateDependencies.has(state) &&
        !data.stateDependents.get(state)?.size
    ) {
        return
    }

    let pending = data.pendingOrphanCleanup as Set<State> | undefined
    if (!pending) {
        pending = new Set()
        data.pendingOrphanCleanup = pending
    }
    pending.add(state)
    if (data.orphanCleanupScheduled) return
    data.orphanCleanupScheduled = true
    queueMicrotask(() => {
        data.orphanCleanupScheduled = false
        flushPendingOrphanCleanup(data)
    })
}
