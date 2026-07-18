import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import { isSelector } from "../utils/isSelector"

/**
 * Record a materialized state value changing. Revision tracking is enabled by
 * the first cold selector cache in the store tree; atom-only stores therefore
 * keep the write hot path to one predictable boolean branch.
 */
export const noteStateValueChanged = (state: WeakKey, data: StoreData) => {
    const clock = data.stateRevisionClock
    if (!clock.enabled) return
    data.stateRevisions.set(state, ++clock.current)
}

/** Resolve the revision of the value this store would actually read. Scoped
 * atoms without a local shadow inherit their closest ancestor's revision. */
export const getStateRevision = (state: WeakKey, data: StoreData): number => {
    if (isSelector(state) || data.values.has(state) || !data.parent) {
        return data.stateRevisions.get(state) ?? 0
    }
    return getStateRevision(state, data.parent)
}

/** Snapshot a cold selector's forward dependencies without putting the
 * selector in any dependency's strongly-held reverse Set. */
export const recordColdSelectorCache = (
    selector: Selector,
    dependencies: Set<State>,
    data: StoreData,
    revisions?: Map<State, number>,
): boolean => {
    if (data.selectorGraphActive.has(selector)) {
        data.coldSelectorCaches.delete(selector)
        return true
    }

    const clock = data.stateRevisionClock
    clock.enabled = true
    const dependencyRevisions: number[] = []
    let matchesCurrentValues = true
    for (const dependency of dependencies) {
        const currentRevision = getStateRevision(dependency, data)
        const revision = revisions?.get(dependency) ?? currentRevision
        dependencyRevisions.push(revision)
        if (revision !== currentRevision) {
            matchesCurrentValues = false
        }
    }
    data.coldSelectorCaches.set(selector, {
        dependencyRevisions,
        validatedAt: matchesCurrentValues ? clock.current : -1,
    })
    return matchesCurrentValues
}

/** A selector write advances the shared clock after its dependency snapshot was
 * recorded. Move a known-current snapshot forward without rebuilding it. */
export const markColdSelectorCacheValidated = (
    selector: Selector,
    data: StoreData,
) => {
    const cache = data.coldSelectorCaches.get(selector)
    if (cache) cache.validatedAt = data.stateRevisionClock.current
}
