import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { ScopedStoreData, StoreData } from "../types/StoreData"
import { deepFreeze } from "../utils/deepFreeze"
import { isProd } from "./isProd"

/** Register `key` in the parent's scopeValueIndex. Caller MUST ensure
 *  `data` is a ScopedStoreData (has a parent). */
export const trackScopeValue = (key: WeakKey, data: ScopedStoreData) => {
    const parent = data.parent
    let set = parent.scopeValueIndex.get(key)
    if (!set) {
        set = new Set()
        parent.scopeValueIndex.set(key, set)
    }
    set.add(data)
    data.scopeIndexKeys.add(key)
}

declare global {
    /** Dev-only escape hatch for skipping deepFreeze on every write. Set
     *  `globalThis.__valdres_dev_skip_freeze__ = true` from a browser
     *  shim or Node bootstrap script to bypass freezing without setting
     *  `NODE_ENV=production` (which has other consequences in bundlers
     *  and dev tooling like React Refresh). Only use when you trust all
     *  consumers not to mutate atom values in place. */
    // eslint-disable-next-line no-var
    var __valdres_dev_skip_freeze__: boolean | undefined
}

const skipFreezeOverride = (): boolean =>
    typeof globalThis !== "undefined" &&
    globalThis.__valdres_dev_skip_freeze__ === true

export const setValueInData = <Value extends unknown>(
    atom: Atom<Value> | AtomFamily<any, any>,
    value: Value,
    data: StoreData,
): Value => {
    // Only track atoms (not selectors) in scopeValueIndex. Selectors are
    // also passed here via loose typing but should not pollute the index.
    // Family tracking is handled separately in initFamilyIndex.
    const isNewAtomInScope =
        "parent" in data && Object.hasOwn(atom, "defaultValue") && !data.values.has(atom)
    let written: Value
    if (atom.mutable || isProd() || skipFreezeOverride()) {
        data.values.set(atom, value)
        written = value
    } else {
        // Skip deepFreeze for primitives — they are immutable by nature
        const frozenValue = value !== null && (typeof value === "object" || typeof value === "function")
            ? deepFreeze(value)
            : value
        data.values.set(atom, frozenValue)
        written = frozenValue
    }
    if (isNewAtomInScope) trackScopeValue(atom, data as ScopedStoreData)
    // Record the write timestamp for atoms with maxAge so unmounted reads
    // can lazily revalidate once the freshness window has elapsed.
    if ((atom as Atom<Value>).maxAge !== undefined) {
        data.lastValueWriteAt.set(atom, Date.now())
    }
    return written
}
