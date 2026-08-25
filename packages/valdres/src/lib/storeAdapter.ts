import type { Store } from "../types/Store"
import type { State } from "../types/State"
import { getStoreData } from "./getStoreData"
import { STORE_DATA_ACCESS } from "./storeDataAccessToken"

/** Versioned, capability-based access for framework and tooling adapters. */
export const storeAdapter = Object.freeze({
    /**
     * Read a framework snapshot that is expected to gain a subscription during
     * the same render commit. Cold selector graphs are provisionally promoted;
     * an abandoned render is cleaned up automatically.
     */
    getForSubscription<Value>(store: Store, state: State<Value>): Value {
        return (
            store.txn as unknown as (
                token: typeof STORE_DATA_ACCESS,
                state: State<Value>,
            ) => Value
        )(STORE_DATA_ACCESS, state)
    },
    isBatching(store: Store): boolean {
        return getStoreData(store).batchUpdates === true
    },
    isEnumerable(store: Store): boolean {
        return getStoreData(store).enumerable === true
    },
    /** @deprecated Public since 1.0.0-beta.20 as `store.hasScope(scopeId)`.
     *  Kept so an adapter pinned to this capability object keeps working; it
     *  now just forwards. */
    hasScope(store: Store, scopeId: string): boolean {
        return store.hasScope(scopeId)
    },
    hasScopePath(store: Store, scopeIds: readonly string[]): boolean {
        let data = getStoreData(store)
        for (const scopeId of scopeIds) {
            const scope = data.scopes.get(scopeId)
            if (!scope) return false
            data = scope
        }
        return true
    },
})
