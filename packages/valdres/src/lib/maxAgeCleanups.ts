import type { StoreData } from "../types/StoreData"
import { trackStoreCleanup, untrackStoreCleanup } from "./storeLifecycle"

// Per-store maxAge cleanup functions, keyed by (data, state).
// Stored here so any subscription's unsub can trigger cleanup when
// the last subscriber leaves, not just the first subscriber's unsub.
const maxAgeCleanups = new WeakMap<StoreData, WeakMap<WeakKey, () => void>>()

export const setMaxAgeCleanup = (
    data: StoreData,
    state: WeakKey,
    cleanup: () => void,
) => {
    let storeMap = maxAgeCleanups.get(data)
    if (!storeMap) {
        storeMap = new WeakMap()
        maxAgeCleanups.set(data, storeMap)
    }
    const previous = storeMap.get(state)
    if (previous) untrackStoreCleanup(data, previous)
    let active = true
    const trackedCleanup = () => {
        if (!active) return
        active = false
        untrackStoreCleanup(data, trackedCleanup)
        cleanup()
    }
    storeMap.set(state, trackedCleanup)
    trackStoreCleanup(data, trackedCleanup)
}

export const getMaxAgeCleanup = (
    data: StoreData,
    state: WeakKey,
): (() => void) | undefined => {
    return maxAgeCleanups.get(data)?.get(state)
}

export const deleteMaxAgeCleanup = (data: StoreData, state: WeakKey) => {
    const storeMap = maxAgeCleanups.get(data)
    const cleanup = storeMap?.get(state)
    if (cleanup) untrackStoreCleanup(data, cleanup)
    storeMap?.delete(state)
}
