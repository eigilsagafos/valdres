import type { StoreData } from "../types/StoreData"

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
    storeMap.set(state, cleanup)
}

export const getMaxAgeCleanup = (
    data: StoreData,
    state: WeakKey,
): (() => void) | undefined => {
    return maxAgeCleanups.get(data)?.get(state)
}

export const deleteMaxAgeCleanup = (data: StoreData, state: WeakKey) => {
    maxAgeCleanups.get(data)?.delete(state)
}
