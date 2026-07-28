import type { State } from "../../types/State"
import type { StoreData } from "../../types/StoreData"

/**
 * Invalidate topology-sensitive teardown caches after graph construction or
 * churn, and assign the selector's stable per-store materialization order.
 */
export const noteDependencyGraphChanged = (
    selector: State,
    data: StoreData,
) => {
    noteDependencyMaterialized(selector, data)
    data.dependencyGraphVersion++
}

/** Assign the stable evaluation order even when a selector is only cold-cached.
 * Promotion can then preserve the same dependency-before-dependent ordering the
 * eagerly-built graph had, without treating a cold forward set as live topology. */
export const noteDependencyMaterialized = (
    selector: State,
    data: StoreData,
) => {
    if (!data.dependencyOrder.has(selector)) {
        data.dependencyOrder.set(selector, data.nextDependencyOrder++)
    }
}
