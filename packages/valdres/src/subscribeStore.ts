import {
    addStoreChangeListener,
    type StoreChangeListener,
} from "./lib/storeChangeListeners"
import type { Store } from "./types/Store"

/**
 * Subscribe to *every* committed write in a store, including writes to its
 * scopes. The listener receives the changed atoms, the store (or scope) the
 * change happened in, and whether it was a lazy-init-only batch. Returns an
 * unsubscribe function.
 *
 * This is the low-level primitive behind devtools/logging/persistence
 * adapters. For reacting to a single piece of state, use `store.sub` instead.
 */
export const subscribeStore = (
    store: Store,
    listener: StoreChangeListener,
): (() => void) => addStoreChangeListener(store.data, listener)
