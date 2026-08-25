import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { StoreData } from "../types/StoreData"
import { deepFreeze } from "../utils/deepFreeze"
import { endColdValidationPass } from "./stateRevisions"
import { isAtomFamily } from "../utils/isAtomFamily"
import { ensureFamilyAncestorChain } from "./atomFamilyIndex"
import {
    refreshInheritedDependencyBranch,
} from "./graph"
import { IS_PROD } from "./IS_PROD"
import { trackScopeValue } from "./trackScopeValue"
import { cacheState } from "./cacheState"

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
    // A scope that materializes its OWN family index for the first time must be
    // registered in the parent's scopeValueIndex so recursivelyUpdateIndexes can
    // reach it when the parent's membership later changes. The non-txn path does
    // this in initFamilyIndex; the txn path lands the index here via writeAtoms.
    // Doing it at this WRITE (commit) — not in the transaction body — means a
    // transaction that throws registers nothing (valdres has no rollback), so a
    // later parent family write can't deref a scope that never got its index.
    const parent = data.parent
    let isNewAtomInScope = false
    let isNewFamilyInScope = false
    if (parent && !data.values.has(atom)) {
        isNewAtomInScope = Object.hasOwn(atom, "defaultValue")
        isNewFamilyInScope = !isNewAtomInScope && isAtomFamily(atom)
    }
    // Dev-only freeze decision. Kept inline (not a shared helper) because the
    // extra call frame measurably regresses the hot primitive-set path. The
    // staging-time copy of this policy lives in `normalizeStagedValue` (which
    // Transaction.set and Transaction.batchSetFamilyAtoms both call).
    //
    // Two policies share the condition below, and they have different owners:
    //   - the VALUE policy (mutable / production / freeze depth) is pinned by
    //     `deepFreezePolicyFuzz.test.ts`, which drives every write path with the
    //     same value and requires one outcome, so a drift between the two copies
    //     surfaces as a path disagreement.
    //   - the `typeof atom === "function"` exemption, which keeps a FAMILY's own
    //     mutable membership-index carrier out of the user-value contract, is
    //     invisible to that fuzz (it writes family MEMBERS, never the carrier).
    //     Removing it fails the `hydrate` tests instead.
    let written: Value
    // Atom families store Valdres' own mutable membership-index carrier in the
    // values map. Families are callable; ordinary atom descriptors are objects,
    // so this cheap type check keeps that internal bookkeeping out of the user
    // value freeze contract without an isAtomFamily helper call on every write.
    if ((atom as Atom<Value>).mutable || IS_PROD || typeof atom === "function") {
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
    // Cold-selector revision tracking is enabled lazily. Keep the atom-only
    // write hot path to this one predictable branch and avoid a helper frame.
    const tree = data.tree
    if (tree.revisionEnabled && tree.trackedRevisions!.has(atom)) {
        data.stateRevisions.set(atom, ++tree.revision)
    }
    // A write landing INSIDE a cold-cache validation walk (user code re-entering
    // the store from a selector body, a lazy default resolving) voids that walk's
    // premise. Deliberately OUTSIDE the tracking guard above: an UNTRACKED atom
    // bumps no revision of its own, but its write still propagates into live
    // selectors that ARE tracked dependencies of cold snapshots, so the walk's
    // conclusions are just as void. See lib/stateRevisions.ts.
    if (tree.coldValidationDepth !== 0) endColdValidationPass(atom, tree)
    if (isNewAtomInScope) {
        trackScopeValue(atom, data)
        // The new shadow cuts this store's dependent subtree off from ancestor
        // writes. Keep the complementary inherited-dependency index in sync.
        refreshInheritedDependencyBranch(atom, data)
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
        cacheState.recordWrite(atom as Atom<Value>, data)
    }
    return written
}
