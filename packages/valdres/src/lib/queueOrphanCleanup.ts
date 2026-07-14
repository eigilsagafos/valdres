import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { flushPendingOrphanCleanup } from "./flushPendingOrphanCleanup"

/**
 * Batch orphan graph/value cleanup across a synchronous unsubscribe burst.
 * This one-microtask delay is intentional: lifecycle cleanup already ran
 * synchronously, and every public store operation drains this queue before it
 * can observe or mutate selector caches.
 */
export const queueOrphanCleanup = (state: State, data: StoreData) => {
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
