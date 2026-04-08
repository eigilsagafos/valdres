import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { ScopedStoreData, StoreData } from "../types/StoreData"
import { deepFreeze } from "../utils/deepFreeze"
import { isProd } from "./isProd"

/** Register `key` in the parent's scopeValueIndex. Caller MUST ensure
 *  `data` is a ScopedStoreData (has a parent). */
export const trackScopeValue = (key: any, data: ScopedStoreData) => {
    const parent = data.parent
    let set = parent.scopeValueIndex.get(key)
    if (!set) {
        set = new Set()
        parent.scopeValueIndex.set(key, set)
    }
    set.add(data)
    data.scopeIndexKeys.add(key)
}

export const setValueInData = <Value extends unknown>(
    atom: Atom<Value> | AtomFamily<any, any>,
    value: Value,
    data: StoreData,
): Value => {
    // Only track atoms (not selectors) in scopeValueIndex. Selectors are
    // also passed here via loose typing but should not pollute the index.
    // Family tracking is handled separately in initFamilyIndex.
    const isNewAtomInScope =
        "parent" in data && "defaultValue" in atom && !data.values.has(atom)
    if (atom.mutable || isProd()) {
        data.values.set(atom, value)
        if (isNewAtomInScope) trackScopeValue(atom, data as ScopedStoreData)
        return value
    } else {
        // Skip deepFreeze for primitives — they are immutable by nature
        const frozenValue = value !== null && (typeof value === "object" || typeof value === "function")
            ? deepFreeze(value)
            : value
        data.values.set(atom, frozenValue)
        if (isNewAtomInScope) trackScopeValue(atom, data as ScopedStoreData)
        return frozenValue
    }
}
