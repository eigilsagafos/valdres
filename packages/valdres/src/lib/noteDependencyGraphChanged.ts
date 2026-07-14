import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"

/**
 * Invalidate topology-sensitive teardown caches after graph construction or
 * churn, and assign the selector's stable per-store materialization order.
 */
export const noteDependencyGraphChanged = (
    selector: State,
    data: StoreData,
) => {
    if (!data.dependencyOrder.has(selector)) {
        data.dependencyOrder.set(selector, data.nextDependencyOrder++)
    }
    data.dependencyGraphVersion++
}
