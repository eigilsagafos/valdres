import type { StoreData } from "../types/StoreData"

/** Register `key` (an atom or family) in the parent's scopeValueIndex, recording
 *  it in this scope's scopeIndexKeys for cleanup on detach. Throws if called on
 *  a root store — `parent` and `scopeIndexKeys` are only populated for scoped
 *  stores (see createStoreData).
 *
 *  Lives in its own module (rather than setValueInData) so both the scope-value
 *  write path (setValueInData) and the family-index path (atomFamilyIndex) can
 *  depend on it without an import cycle. */
export const trackScopeValue = (key: WeakKey, data: StoreData) => {
    const parent = data.parent
    const indexKeys = data.scopeIndexKeys
    if (!parent || !indexKeys) {
        throw new Error("trackScopeValue called on a root store")
    }
    let set = parent.scopeValueIndex.get(key)
    if (!set) {
        set = new Set()
        parent.scopeValueIndex.set(key, set)
    }
    set.add(data)
    indexKeys.add(key)
}
