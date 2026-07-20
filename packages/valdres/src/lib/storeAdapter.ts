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
    hasScope(store: Store, scopeId: string): boolean {
        return getStoreData(store).scopes.has(scopeId)
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
