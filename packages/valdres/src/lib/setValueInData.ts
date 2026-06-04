import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { StoreData } from "../types/StoreData"
import { deepFreeze } from "../utils/deepFreeze"
import { IS_PROD } from "./IS_PROD"

/** Register `key` in the parent's scopeValueIndex. Throws if called on
 *  a root store — `parent` and `scopeIndexKeys` are only populated for
 *  scoped stores (see createStoreData). */
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

export const setValueInData = <Value extends unknown>(
    atom: Atom<Value> | AtomFamily<any, any>,
    value: Value,
    data: StoreData,
): Value => {
    // Only track atoms (not selectors) in scopeValueIndex. Selectors are
    // also passed here via loose typing but should not pollute the index.
    // Family tracking is handled separately in initFamilyIndex.
    const isNewAtomInScope =
        data.parent && Object.hasOwn(atom, "defaultValue") && !data.values.has(atom)
    // Dev-only freeze decision. Kept inline (not a shared helper) because the
    // extra call frame measurably regresses the hot primitive-set path; if you
    // change this policy, keep Transaction.set in transaction.ts in sync.
    let written: Value
    if (atom.mutable || IS_PROD) {
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
    if (isNewAtomInScope) {
        trackScopeValue(atom, data)
        // This scope now shadows `atom`, so any subscription here that was
        // delegating to an ancestor must stop delegating now — otherwise an
        // ancestor write in the same transaction commit would notify it in
        // addition to this scope's own notification. subscribe() also drops the
        // delegate lazily on the first scope-local callback, but in a single
        // cross-scope commit the ancestor's notify pass can run first; dropping
        // it here (during the write phase, before any notification) keeps the
        // subscriber single-fire. Idempotent with the lazy path.
        const subs = data.subscriptions.get(atom)
        if (subs) {
            for (const sub of subs) sub.reRoot?.()
        }
    }
    // Record the write timestamp for atoms with maxAge so unmounted reads
    // can lazily revalidate once the freshness window has elapsed.
    if ((atom as Atom<Value>).maxAge !== undefined) {
        data.lastValueWriteAt.set(atom, Date.now())
    }
    return written
}
