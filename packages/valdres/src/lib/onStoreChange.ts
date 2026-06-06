import type { StoreChangeCallback } from "../types/StoreChangeCallback"
import type { StoreData } from "../types/StoreData"
import { changeListenerRegistry } from "./notifyChangeListeners"

/** Register a store-wide change listener on `data`. The listener fires once per
 *  committed operation with every atom that changed in this store or any of its
 *  descendant scopes. Returns an unsubscribe function. */
export const onStoreChange = (
    callback: StoreChangeCallback,
    data: StoreData,
): (() => void) => {
    let listeners = data.changeListeners
    if (!listeners) {
        listeners = new Set()
        data.changeListeners = listeners
    }
    const sizeBefore = listeners.size
    listeners.add(callback)
    // Only bump the global gate when the callback is genuinely new (Set.add is
    // a no-op for a duplicate), so add/remove stay balanced.
    if (listeners.size > sizeBefore) changeListenerRegistry.count++
    return () => {
        const current = data.changeListeners
        if (!current) return
        if (current.delete(callback)) {
            changeListenerRegistry.count--
            // Drop the set entirely when empty so the parent-chain walk in
            // hasChangeListener stops at this store.
            if (current.size === 0) data.changeListeners = undefined
        }
    }
}
