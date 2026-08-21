import type { Store } from "../types/Store"
import { getStoreData } from "./getStoreData"

/** Versioned, capability-based access for framework and tooling adapters. */
export const storeAdapter = Object.freeze({
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
