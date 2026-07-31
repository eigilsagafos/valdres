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
    const tree = data.tree
    if (!tree.revisionEnabled || !tree.trackedRevisions!.has(state)) return
    data.stateRevisions.set(state, ++tree.revision)
}

/** Start maintaining a revision for a state newly discovered by a cold async
 * selector. This must happen at read time, not promise settlement, so a write
 * between those events advances beyond the revision the evaluation observed. */
export const trackStateRevision = (state: WeakKey, data: StoreData) => {
    const tree = data.tree
    const tracked = (tree.trackedRevisions ??= new WeakSet())
    tracked.add(state)
    tree.revisionEnabled = true
}

/** Resolve the revision of the value this store would actually read. Scoped
 * atoms without a local shadow inherit their closest ancestor's revision. */
export const getStateRevision = (state: WeakKey, data: StoreData): number => {
    // Root stores dominate. Check parent first so their revision reads avoid an
    // otherwise redundant values.has() WeakMap probe.
    if (!data.parent || data.values.has(state)) {
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

    data.coldSelectorCachesEnabled = true
    const tree = data.tree
    const tracked = (tree.trackedRevisions ??= new WeakSet())
    tree.revisionEnabled = true
    const existingCache = data.coldSelectorCaches.get(selector)
    const dependencyStates = existingCache?.dependencies ?? []
    const dependencyRevisions = existingCache?.dependencyRevisions ?? []
    dependencyRevisions.length = 0
    let hasSelectorDependencies = false
    let matchesCurrentValues = true
    let index = 0
    for (const dependency of dependencies) {
        if (dependencyStates[index] !== dependency) {
            tracked.add(dependency)
        }
        dependencyStates[index] = dependency
        if (isSelector(dependency)) hasSelectorDependencies = true
        const currentRevision = getStateRevision(dependency, data)
        const revision = revisions?.get(dependency) ?? currentRevision
        dependencyRevisions.push(revision)
        if (revision !== currentRevision) {
            matchesCurrentValues = false
        }
        index++
    }
    dependencyStates.length = index
    const validatedAt = matchesCurrentValues ? tree.revision : -1
    if (existingCache) {
        existingCache.hasSelectorDependencies = hasSelectorDependencies
        existingCache.validatedAt = validatedAt
    } else {
        data.coldSelectorCaches.set(selector, {
            dependencies: dependencyStates,
            dependencyRevisions,
            validatedAt,
            hasSelectorDependencies,
        })
    }
    return matchesCurrentValues
}

/** A selector write advances the shared clock after its dependency snapshot was
 * recorded. Move a known-current snapshot forward without rebuilding it. */
export const markColdSelectorCacheValidated = (
    selector: Selector,
    data: StoreData,
) => {
    const cache = data.coldSelectorCaches.get(selector)
    if (cache) cache.validatedAt = data.tree.revision
}
