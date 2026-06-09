import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { StoreData } from "../types/StoreData"
import { deepFreeze } from "../utils/deepFreeze"
import { isAtomFamily } from "../utils/isAtomFamily"
import { ensureFamilyAncestorChain } from "./atomFamilyIndex"
import { IS_PROD } from "./IS_PROD"
import { trackScopeValue } from "./trackScopeValue"

// Re-exported for existing importers; the definition lives in ./trackScopeValue
// so the family-index module can depend on it without an import cycle.
export { trackScopeValue }

export const setValueInData = <Value extends unknown>(
    atom: Atom<Value> | AtomFamily<any, any>,
    value: Value,
    data: StoreData,
): Value => {
    // Track scope-shadowing in scopeValueIndex for atoms (below) and, in the
    // `isNewFamilyInScope` branch further down, for families whose index is first
    // materialized by a transaction commit (the non-txn path tracks families in
    // initFamilyIndex instead). Selectors are also passed here via loose typing
    // but must NOT be tracked — `Object.hasOwn(atom, "defaultValue")` admits only
    // atoms, and `isAtomFamily` only families, so selectors fall through both.
    const isNewAtomInScope =
        data.parent && Object.hasOwn(atom, "defaultValue") && !data.values.has(atom)
    // A scope that materializes its OWN family index for the first time must be
    // registered in the parent's scopeValueIndex so recursivelyUpdateIndexes can
    // reach it when the parent's membership later changes. The non-txn path does
    // this in initFamilyIndex; the txn path lands the index here via writeAtoms.
    // Doing it at this WRITE (commit) — not in the transaction body — means a
    // transaction that throws registers nothing (valdres has no rollback), so a
    // later parent family write can't deref a scope that never got its index.
    const isNewFamilyInScope =
        !!data.parent && !data.values.has(atom) && isAtomFamily(atom)
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
    } else if (isNewFamilyInScope) {
        // Register this scope under its parent, then make sure every intermediate
        // ancestor scope also has the family index and is registered — the txn
        // commit lands a flat index here that can skip intermediate scopes, and
        // ensureFamilyAncestorChain reuses initFamilyIndex's chain walk to repair
        // that (and re-link this scope's parentIndex to its immediate parent).
        trackScopeValue(atom, data)
        ensureFamilyAncestorChain(atom as AtomFamily<any, any>, data)
    }
    // Record the write timestamp for atoms with maxAge so unmounted reads
    // can lazily revalidate once the freshness window has elapsed.
    if ((atom as Atom<Value>).maxAge !== undefined) {
        data.lastValueWriteAt.set(atom, Date.now())
    }
    return written
}
