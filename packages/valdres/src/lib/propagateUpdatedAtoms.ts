import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { Family } from "../types/Family"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import {
    addFamilyAtomsToSet,
    deleteFamilyAtomsFromSet,
    recursivelyUpdateIndexes,
} from "./atomFamilyIndex"
import type { DepsChange } from "./initSelector"
import {
    evaluateSelector,
    handleSelectorResult,
} from "./initSelector"
import {
    beginLivenessPass,
    endLivenessPass,
    isLive,
    mountTransitiveDeps,
    onLiveDependencyAdded,
    onLiveDependencyRemoved,
    reconcileLivenessAfterChurn,
    unmountOrphanedDeps,
} from "./mountAtom"
import {
    changeListenerRegistry,
    createChangeSink,
    flushChangeSink,
    hasSelectorChangeListener,
    reportAtomChanges,
    reportDeletedAtoms,
    reportSelectorChanges,
    type ChangeReport,
    type ChangeSink,
} from "./notifyChangeListeners"
import { beginCommit, commitEndRegistry, endCommit } from "./onCommitEnd"
import { setValueInData } from "./setValueInData"

export type {
    AtomFamilyIndex,
} from "./atomFamilyIndex"
export {
    cloneAtomFamilyIndex,
    createAtomFamilyIndex,
    renderAtomFamilyIndex,
} from "./atomFamilyIndex"

type AtomInput = Atom<any> | AtomFamilyAtom<any, any> | AtomFamily<any, any>

// Deferred-notification target for a multi-pass commit (a cross-scope txn, or a
// single-store update+delete txn). Each store-pass collects its subscribers here
// instead of firing them; the commit fires them ONCE at the very end — after
// every value across every store is final. That is what makes a transaction
// *serializable to observe*: no subscriber, and nothing a SYNCHRONOUS selector a
// subscriber reads, ever sees a half-applied intermediate. (Scope: an async /
// Promise-returning selector still notifies again when its promise resolves — a
// separate, later microtask, outside the commit — so "fires exactly once with
// the final value" is the guarantee for synchronous selectors.) Left undefined
// on the single-store / non-scoped hot path, where firing stays inline.
//
// PARTITIONED PER STORE. The same selector/family lives — with different values
// and different changed members — in the root and in each scope, and a single
// family subscription is registered in exactly one store (a scope's read-through
// family subscription is *delegated* into the parent's store AND kept in the
// scope's store, as two distinct objects). So we collect per StoreData and fire
// each store's subscriptions only against the family members that changed in
// THAT store. A flat, store-agnostic map regressed this: a root family
// subscriber fired for members that only changed in a nested scope, and a
// scope's delegated+local subscriptions both fired against the merged member set.
//
// ⚠️ DO NOT reintroduce a per-commit "evaluate each selector at most once across
// passes" dedup guard. We shipped one (an `evaluatedSelectors` set, #168) and it
// caused two correctness regressions, both subtle and both expensive to find:
//   1. Keyed by selector OBJECT, it skipped a scope's copy of a selector that
//      was also live in the root (different value per store) — left stale.
//   2. It locked in a value an early pass computed from an intermediate selector
//      that a LATER pass corrected — also left stale.
// The model here is deliberately dumb and robust instead: write every value
// first, then each store re-derives its OWN selectors against that final state
// (a selector reachable by two passes is simply recomputed in each — the
// equality check discards the redundant result), then notify once. A selector's
// value is a pure function of the committed atom state, and running passes
// root-first means read-through ancestor values are already final, so the last
// pass to touch a selector always lands on the correct value — no outer fixpoint
// loop needed. If cross-scope-commit CPU ever matters, add dedup ONLY as a pure
// optimization *behind* this guarantee: keyed per (store, selector), skipping
// only a re-eval that is provably value-identical — never as a correctness
// shortcut that suppresses a needed recompute.
type NotifyStoreEntry = {
    subscriptions: Set<Subscription>
    families: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>
}
export type NotifyTarget = Map<StoreData, NotifyStoreEntry>

const notifyEntryFor = (
    notify: NotifyTarget,
    data: StoreData,
): NotifyStoreEntry => {
    let entry = notify.get(data)
    if (entry === undefined) {
        entry = { subscriptions: new Set(), families: new Map() }
        notify.set(data, entry)
    }
    return entry
}

const reEvaluateSelector = (
    selector: Selector,
    data: StoreData,
    updatedAtoms: Set<Atom>,
    depsChange: DepsChange,
    existingValue: unknown,
): boolean => {
    try {
        const rawValue = evaluateSelector(
            selector,
            data,
            updatedAtoms,
            undefined,
            depsChange,
        )
        const updatedValue = handleSelectorResult(rawValue, selector, data)

        // Use reference equality for promises — deep equal treats all
        // promises as structurally identical (both have zero own keys).
        const areEqual =
            isPromiseLike(existingValue) || isPromiseLike(updatedValue)
                ? existingValue === updatedValue
                : selector.equal(existingValue, updatedValue, updatedAtoms)
        if (areEqual) return false
        setValueInData(selector, updatedValue, data)
        return true
    } catch {
        data.values.delete(selector)
        return true
    }
}

const callSubscribers = (
    subscriptions: Iterable<Subscription>,
    families?: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>,
) => {
    let firstError: unknown
    let hasError = false
    for (const subscription of subscriptions) {
        if ("state" in subscription) {
            const updatedFamilyAtoms = families?.get(subscription.state)
            if (updatedFamilyAtoms) {
                for (const atom of updatedFamilyAtoms) {
                    try {
                        subscription.callback(...atom.familyArgs)
                    } catch (error) {
                        if (!hasError) {
                            firstError = error
                            hasError = true
                        }
                    }
                }
            }
        } else {
            try {
                subscription.callback()
            } catch (error) {
                if (!hasError) {
                    firstError = error
                    hasError = true
                }
            }
        }
    }
    if (hasError) throw firstError
}

// Fire the subscribers accumulated by a deferred (multi-pass) commit, once,
// after every pass has run and every value is final. Per store (root-first, by
// insertion order): each store's subscriptions fire against only that store's
// changed family members, so a family subscription never fires for a member
// that changed in a different store.
export const notifyDeferred = (notify: NotifyTarget) => {
    // Fire EVERY store's subscribers even if one throws, then rethrow the first
    // error — the same "fire all, surface the first error" contract that
    // callSubscribers applies within a set, extended across stores. Without the
    // try/catch, a throwing subscriber in an earlier (root) entry would abort the
    // loop and silently drop a later (scope) entry's notification for writes that
    // were already committed in the same atomic transaction.
    let firstError: unknown
    let hasError = false
    for (const entry of notify.values()) {
        if (entry.subscriptions.size > 0) {
            try {
                callSubscribers(entry.subscriptions, entry.families)
            } catch (error) {
                if (!hasError) {
                    firstError = error
                    hasError = true
                }
            }
        }
    }
    if (hasError) throw firstError
}

// Record a pass's changed family members into its store's notify entry, so
// callSubscribers can resolve that store's family-atom subscriptions once at
// commit end. This is the NOTIFICATION side only. The per-pass map handed in
// here is the SAME data a pass uses to drive index bookkeeping
// (add/deleteFamilyAtomsFromSet) — but those two roles must NOT share one
// mutable map across passes: the bookkeeping map has to contain only THIS pass's
// atoms (a delete pass that saw an earlier pass's added atoms would delete them).
// So each pass keeps its bookkeeping map local and merges it here for notification.
const collectFamilyAtomsForNotify = (
    entry: NotifyStoreEntry,
    changedByFamily: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>,
) => {
    for (const [family, atoms] of changedByFamily) {
        let target = entry.families.get(family)
        if (target === undefined) {
            target = new Set()
            entry.families.set(family, target)
        }
        for (const atom of atoms) target.add(atom)
    }
}

const addSetToSet = (fromSet: Set<any> | undefined, toSet: Set<any>) => {
    if (fromSet && fromSet.size > 0) {
        for (const item of fromSet) {
            toSet.add(item)
        }
    }
}

const findClosestStoreWithAtomInitialized = (
    atom: State | Family<any>,
    data: StoreData,
) => {
    if (!data.parent) return data
    if (data.values.has(atom)) return data
    return findClosestStoreWithAtomInitialized(atom, data.parent)
}

const findInClosestStore = (
    state: State<any> | Family<any>,
    data: StoreData,
) => {
    const store = findClosestStoreWithAtomInitialized(state, data)
    return store.values.get(state)
}

export const propagateDeletedAtoms = (
    atoms: AtomFamilyAtom<any, any>[],
    data: StoreData,
    subscriptions: Set<Subscription> = new Set(),
    // Per-call ONLY (never a cross-pass accumulator): the family atoms deleted
    // in THIS call. Drives deletion bookkeeping (deleteFamilyAtomsFromSet) and
    // is merged into notify.families afterwards for deferred notification. See
    // collectFamilyAtomsForNotify for why bookkeeping and notification must not
    // share one map across passes.
    deletedFamilyAtoms: Map<
        AtomFamily<any>,
        Set<AtomFamilyAtom<any>>
    > = new Map(),
    timestamp = performance.now(),
    notify?: NotifyTarget,
    report?: ChangeReport,
) => {
    // Commit boundary for store.onCommitEnd. With no listener anywhere this
    // is a single global counter read on the Bencher-gated propagation hot
    // path — no tracking, no allocation, no extra call frame. When listeners
    // exist, the OUTERMOST boundary fires them exactly once, after every
    // subscriber callback; boundaries opened while another is in flight (a
    // transaction's per-store passes, a write from inside a subscriber) only
    // move the tree's depth counter. On a throw the listeners still fire
    // (writes were applied) but their own errors are swallowed so they never
    // mask the original failure.
    let commitRoot: StoreData | undefined
    if (commitEndRegistry.count !== 0) commitRoot = beginCommit(data)
    let completed = false
    try {
        // When deferring, subscribers accumulate into THIS store's notify entry so
        // they fire once, at commit end, against this store's changed members.
        const notifyEntry = notify ? notifyEntryFor(notify, data) : undefined
        if (notifyEntry) {
            subscriptions = notifyEntry.subscriptions
        }
        const selectors = new Set<Selector>()
        for (const atom of atoms) {
            addSetToSet(data.stateDependents.get(atom), selectors)
            addSetToSet(data.subscriptions.get(atom), subscriptions)

            if (isFamilyAtom(atom)) {
                if (!deletedFamilyAtoms.has(atom.family)) {
                    deletedFamilyAtoms.set(atom.family, new Set())
                }
                // @ts-ignore
                deletedFamilyAtoms.get(atom.family).add(atom)
            }
        }
        if (deletedFamilyAtoms.size > 0) {
            for (const [family, familyAtoms] of deletedFamilyAtoms) {
                addSetToSet(data.stateDependents.get(family), selectors)
                addSetToSet(data.subscriptions.get(family), subscriptions)
                if (familyAtoms.size === 0)
                    throw new Error("Should not be possible")

                deleteFamilyAtomsFromSet(family, familyAtoms, data, timestamp)
            }
        }
        // `selectorCount` is the cheap global short-circuit; `hasSelectorChangeListener`
        // then confirms a selector listener actually exists on THIS store's ancestor
        // chain, so an unrelated root store with a selector listener doesn't make this
        // one pay for selector collection.
        const selectorActive =
            report !== undefined &&
            changeListenerRegistry.selectorCount !== 0 &&
            hasSelectorChangeListener(data)
        const changedSelectors = selectorActive ? new Set<Selector>() : undefined
        propagateDirtySelectors(atoms, selectors, data, subscriptions, deletedFamilyAtoms, false, notify, changedSelectors)
        if (notifyEntry) collectFamilyAtomsForNotify(notifyEntry, deletedFamilyAtoms)
        const hasScopeCascade = !!data.scopes && data.scopes.size > 0
        const watching = report !== undefined && changeListenerRegistry.count !== 0

        // When a selector listener is active and this delete cascades into scopes,
        // the origin group + each scope's selector group must coalesce into one
        // callback. On the immediate path (string report) buffer them into a
        // transient sink tagged with the real source; the txn path already passes a
        // sink. (Mirror of the wrap in propagateAtomUpdate.)
        let localSink: ChangeSink | undefined
        let effectiveReport: ChangeReport | undefined = report
        if (selectorActive && hasScopeCascade && typeof report === "string") {
            localSink = createChangeSink(undefined, report)
            effectiveReport = localSink
        }
        // When buffering into a sink, report the origin deletes BEFORE cascading so
        // they precede descendant-scope selectors in the single callback (the sink
        // flushes at the end, so this only orders the batch). A bare string report
        // fires immediately and stays AFTER the cascade to keep onChange last.
        const reportIsSink =
            effectiveReport !== undefined && typeof effectiveReport !== "string"
        if (watching && reportIsSink)
            reportDeletedAtoms(atoms, data, effectiveReport as ChangeReport, changedSelectors)

        // Cross-propagate the deletion into descendant scopes, mirroring the update
        // path (propagateAtomUpdate → propagateToScopes), and thread `effectiveReport`
        // so the scoped selector recomputes are reported too. deleteFamilyAtomsFromSet
        // already re-rendered each shadowing scope's family index; this re-evaluates
        // the dependent selectors so their subscribers fire. Two kinds of scope
        // dependent are reached: a scope that merely INHERITS the deleted member and
        // reads it directly (get(family("a"))), and a non-shadowing scope whose
        // selector reads the family list (get(family)). Members skip scopes that
        // shadow them (visible value unchanged); families always propagate.
        if (hasScopeCascade) {
            const scopeAtoms: AtomInput[] = atoms.slice()
            for (const family of deletedFamilyAtoms.keys()) {
                scopeAtoms.push(family)
            }
            propagateToScopes(scopeAtoms, data, false, notify, effectiveReport)
        }

        if (watching && !reportIsSink)
            reportDeletedAtoms(atoms, data, effectiveReport as ChangeReport, changedSelectors)
        if (localSink) flushChangeSink(localSink)
        completed = true
    } finally {
        if (commitRoot !== undefined) endCommit(commitRoot, !completed)
    }
}

// Top-level entry: notify direct atom subscribers, walk dependent selectors,
// then cross-propagate into scopes.
//
// `notify` (multi-pass commit only): see NotifyTarget. When provided, subscribers
// are collected into it instead of fired, so the commit can fire them once at
// the end. Left undefined on the single-store / non-scoped hot path, where
// firing stays inline and this function is unchanged.
export const propagateAtomUpdate = (
    atoms: AtomInput[],
    data: StoreData,
    isInitOnly = false,
    notify?: NotifyTarget,
    report?: ChangeReport,
    // When true, family-atom members in `atoms` are propagated to their
    // dependent selectors/subscribers but NOT registered in the family index.
    // Used by the deleted-member async-default swap (see getState): the resolved
    // value must reach dependents, but re-adding the member to the index would
    // resurrect a deleted member.
    skipFamilyIndexUpdate = false,
    // When false, the trigger `atoms` are NOT reported to onChange here — only
    // the selectors they cause to recompute are. The caller reports the atoms
    // itself (the `unset` path emits them as `kind: "unset"` via reportUnsetAtom,
    // so they must not also surface as a `"set"`).
    reportAtoms = true,
) => {
    // Commit boundary for store.onCommitEnd. With no listener anywhere this
    // is a single global counter read on the Bencher-gated propagation hot
    // path — no tracking, no allocation, no extra call frame. When listeners
    // exist, the OUTERMOST boundary fires them exactly once, after every
    // subscriber callback; boundaries opened while another is in flight (a
    // transaction's per-store passes, a write from inside a subscriber) only
    // move the tree's depth counter. On a throw the listeners still fire
    // (writes were applied) but their own errors are swallowed so they never
    // mask the original failure.
    let commitRoot: StoreData | undefined
    if (commitEndRegistry.count !== 0) commitRoot = beginCommit(data)
    let completed = false
    try {
        // Fast path: single non-family atom with no dependent selectors and no
        // scopes can skip the full graph walk entirely and just notify subscribers.
        if (atoms.length === 1) {
            const atom = atoms[0]
            if (!isFamilyAtom(atom) && !isAtomFamily(atom)) {
                const dependents = data.stateDependents.get(atom)
                if (
                    (!dependents || dependents.size === 0) &&
                    (!data.scopes || data.scopes.size === 0)
                ) {
                    const subs = data.subscriptions.get(atom)
                    if (subs && subs.size > 0) {
                        // Snapshot the live subscription set before firing. This
                        // is the one path that hands callSubscribers the LIVE
                        // `data.subscriptions` set, so without a copy a listener
                        // that subscribes/unsubscribes from inside a callback
                        // would mutate the set mid-iteration — a listener added
                        // during dispatch would leak into the in-flight change,
                        // an unsubscribed one would be order-dependently skipped.
                        // Snapshotting matches the React/Redux contract: the
                        // listener list is fixed at dispatch start. Copy only
                        // when actually firing (size > 0, already gated). The
                        // deferred path collects into a fresh accumulator and is
                        // already effectively snapshotted — leave it alone.
                        if (notify) addSetToSet(subs, notifyEntryFor(notify, data).subscriptions)
                        else callSubscribers([...subs])
                    }
                    // No dependents here, so there are no selectors to report; only
                    // the atom would be, and only when reportAtoms is set.
                    if (reportAtoms && report !== undefined && changeListenerRegistry.count !== 0 && !isInitOnly) {
                        reportAtomChanges(atoms, data, report)
                    }
                    completed = true
                    return
                }
            }
        }

        const notifyEntry = notify ? notifyEntryFor(notify, data) : undefined
        const subscriptions = notifyEntry ? notifyEntry.subscriptions : new Set<Subscription>()
        // Per-call ONLY (never a cross-pass accumulator): the family atoms updated
        // in THIS call. Drives index bookkeeping (addFamilyAtomsToSet), and is
        // merged into notify.families afterwards for deferred notification — two
        // roles, kept in one local map because within a single pass they are the
        // same data. See collectFamilyAtomsForNotify for why they must not share a
        // map across passes.
        const updatedFamilyAtoms = new Map<
            AtomFamily<any>,
            Set<AtomFamilyAtom<any>>
        >()
        const selectors = new Set<Selector>()

        for (const atom of atoms) {
            addSetToSet(data.stateDependents.get(atom), selectors)
            addSetToSet(data.subscriptions.get(atom), subscriptions)
            if (isFamilyAtom(atom) && !skipFamilyIndexUpdate) {
                if (!updatedFamilyAtoms.has(atom.family)) {
                    updatedFamilyAtoms.set(atom.family, new Set())
                }
                // @ts-ignore
                updatedFamilyAtoms.get(atom.family).add(atom)
            }
        }

        // Families whose MEMBERSHIP changed this pass (a member added/un-deleted, not
        // just an existing member's value re-set). Only these need the family OBJECT
        // propagated into scopes below — a pure value update reaches scope selectors
        // via the member atom, so propagating the family then would be wasted work
        // across every scope (the "family update, 100 scopes" hot path).
        let membershipChanged: Set<AtomFamily<any>> | undefined
        if (updatedFamilyAtoms.size > 0) {
            const timestamp = performance.now()
            for (const [family, familyAtoms] of updatedFamilyAtoms) {
                addSetToSet(data.stateDependents.get(family), selectors)
                addSetToSet(data.subscriptions.get(family), subscriptions)
                if (familyAtoms.size === 0)
                    throw new Error("Should not be possible")
                if (addFamilyAtomsToSet(family, familyAtoms, data, timestamp)) {
                    if (!membershipChanged) membershipChanged = new Set()
                    membershipChanged.add(family)
                }
            }
        }

        // A family OBJECT in `atoms` whose value changed without a corresponding
        // family-atom update (the txn delete case: the rendered list shrank but the
        // deleted member flows through propagateDeletedAtoms, not `families`) means
        // the parent's committed family index may be a freshly cloned object. Re-link
        // shadowing child scopes so their dependent selectors read the new index
        // before they are evaluated below. Family-atom adds already did this via
        // addFamilyAtomsToSet, so skip families handled there.
        if (data.scopes && data.scopes.size > 0) {
            for (const atom of atoms) {
                if (isAtomFamily(atom) && !updatedFamilyAtoms.has(atom)) {
                    recursivelyUpdateIndexes(data, atom)
                }
            }
        }

        // selectorCount is the O(1) global gate; hasSelectorChangeListener then
        // confirms a selector listener exists on this store's ancestor chain, so a
        // selector listener on an unrelated root store adds no overhead here.
        const selectorActive =
            report !== undefined &&
            !isInitOnly &&
            changeListenerRegistry.selectorCount !== 0 &&
            hasSelectorChangeListener(data)
        const changedSelectors = selectorActive ? new Set<Selector>() : undefined
        propagateDirtySelectors(atoms, selectors, data, subscriptions, updatedFamilyAtoms, isInitOnly, notify, changedSelectors)
        if (notifyEntry) collectFamilyAtomsForNotify(notifyEntry, updatedFamilyAtoms)

        const hasScopes = !!data.scopes && data.scopes.size > 0
        const watching =
            report !== undefined && changeListenerRegistry.count !== 0 && !isInitOnly

        // When a selector listener is active and this update cascades into scopes,
        // the origin group (atoms + its selectors) and each descendant scope's
        // selector group must coalesce into a single onChange callback. On the
        // immediate path (string report) that means buffering into a transient sink
        // tagged with the real source and flushing once; the txn path already passes
        // a sink. With no selector listener there's only ever the one origin group,
        // so the string report fires it inline exactly as before.
        let localSink: ChangeSink | undefined
        let effectiveReport: ChangeReport | undefined = report
        if (selectorActive && hasScopes && typeof report === "string") {
            localSink = createChangeSink(undefined, report)
            effectiveReport = localSink
        }
        // When buffering into a sink (the txn sink, or the transient localSink
        // above), buffer the origin group BEFORE cascading into scopes so the origin
        // atoms precede descendant-scope selectors in the single callback. The sink
        // flushes at the end regardless, so this only orders the batch — it does not
        // change when onChange fires. A bare string report (no sink) fires
        // immediately, so it stays AFTER the scope cascade to keep onChange last
        // (after subscribers); that path never carries selector entries anyway.
        const reportIsSink =
            effectiveReport !== undefined && typeof effectiveReport !== "string"
        // reportAtoms=false: emit only the recomputed selectors (the caller reports
        // the trigger atoms — e.g. as `kind: "unset"`).
        const emitOrigin = (rpt: ChangeReport) => {
            if (reportAtoms) {
                reportAtomChanges(atoms, data, rpt, changedSelectors)
            } else if (changedSelectors && changedSelectors.size > 0) {
                reportSelectorChanges(changedSelectors, data, rpt)
            }
        }
        if (watching && reportIsSink) emitOrigin(effectiveReport as ChangeReport)
        if (hasScopes) {
            // A scope selector that reads get(family) depends on the FAMILY object,
            // not the individual member atoms. When the parent's MEMBERSHIP changes (a
            // member added/removed), propagating only the changed members into scopes
            // (as `atoms` holds) re-renders each scope's family index via
            // recursivelyUpdateIndexes above but never re-evaluates those selectors —
            // leaving them stale. So mirror the delete path (propagateDeletedAtoms
            // pushes the family onto its scopeAtoms): also propagate each family whose
            // membership changed. A pure member VALUE-update (membership unchanged) is
            // deliberately NOT included — its scope-side effect reaches selectors via
            // the member atom already in `atoms`, so it keeps the single-atom scope
            // fast path. That gate is `membershipChanged`.
            let scopeAtoms: AtomInput[] = atoms
            if (membershipChanged) {
                scopeAtoms = atoms.slice()
                for (const family of membershipChanged) {
                    if (!scopeAtoms.includes(family)) scopeAtoms.push(family)
                }
            }
            propagateToScopes(scopeAtoms, data, isInitOnly, notify, effectiveReport)
        }
        if (watching && !reportIsSink) emitOrigin(effectiveReport as ChangeReport)
        if (localSink) flushChangeSink(localSink)
        completed = true
    } finally {
        if (commitRoot !== undefined) endCommit(commitRoot, !completed)
    }
}

// Scope-recursive entry: re-evaluate selectors that depend on these atoms in
// this scope and cross into nested scopes. Skips collecting direct atom and
// family subscribers — the parent scope already notified those, and family
// index bookkeeping has already cascaded via recursivelyUpdateIndexes.
export const propagateInScope = (
    atoms: AtomInput[],
    data: StoreData,
    isInitOnly = false,
    notify?: NotifyTarget,
    report?: ChangeReport,
) => {
    // Selector subscribers must accumulate into THIS store's notify entry (so
    // they fire once at the end); `families` is unused here (this entry skips
    // direct atom/family subscribers — the parent pass collected those).
    const subscriptions = notify
        ? notifyEntryFor(notify, data).subscriptions
        : new Set<Subscription>()
    const families = new Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>()
    const selectors = new Set<Selector>()

    for (const atom of atoms) {
        addSetToSet(data.stateDependents.get(atom), selectors)
    }

    // No atom value changes in a cascaded scope (the atom is inherited) — only
    // dependent selectors recompute, so we report just those as this scope's own
    // selector-only group (carrying its scope path) into the same report/sink.
    const changedSelectors =
        report !== undefined &&
        !isInitOnly &&
        changeListenerRegistry.selectorCount !== 0 &&
        hasSelectorChangeListener(data)
            ? new Set<Selector>()
            : undefined

    propagateDirtySelectors(atoms, selectors, data, subscriptions, families, isInitOnly, notify, changedSelectors)

    if (changedSelectors && changedSelectors.size > 0) {
        reportSelectorChanges(changedSelectors, data, report as ChangeReport)
    }

    if (data.scopes && data.scopes.size > 0) {
        propagateToScopes(atoms, data, isInitOnly, notify, report)
    }
}

const propagateToScopes = (
    atoms: AtomInput[],
    data: StoreData,
    isInitOnly: boolean,
    notify?: NotifyTarget,
    report?: ChangeReport,
) => {
    if (atoms.length === 1) {
        // Fast path for single-atom updates (most common case)
        const atom = atoms[0]
        const shadowingScopes = isAtomFamily(atom)
            ? undefined
            : data.scopeValueIndex.get(atom)
        for (const [, scope] of data.scopes) {
            if (!shadowingScopes || !shadowingScopes.has(scope)) {
                propagateInScope(atoms, scope, isInitOnly, notify, report)
            }
        }
        return
    }

    // Multi-atom path: precompute shadow sets once
    let anyShadowed = false
    let atomShadows: Map<any, Set<any>> | undefined
    for (const atom of atoms) {
        if (!isAtomFamily(atom)) {
            const s = data.scopeValueIndex.get(atom)
            if (s && s.size > 0) {
                if (!atomShadows) atomShadows = new Map()
                atomShadows.set(atom, s)
                anyShadowed = true
            }
        }
    }

    if (!anyShadowed) {
        for (const [, scope] of data.scopes) {
            propagateInScope(atoms, scope, isInitOnly, notify, report)
        }
        return
    }

    // Some atoms are shadowed, filter per scope
    for (const [, scope] of data.scopes) {
        const atomsToUpdateInScope: AtomInput[] = []
        for (const atom of atoms) {
            if (isAtomFamily(atom)) {
                // The scope has its own family index, but the parent
                // index may have changed (e.g. a member was deleted
                // from root). Re-evaluate dependent selectors in the
                // scope so subscribers get notified.
                atomsToUpdateInScope.push(atom)
            } else {
                const s = atomShadows!.get(atom)
                if (!s || !s.has(scope)) {
                    atomsToUpdateInScope.push(atom)
                }
            }
        }
        if (atomsToUpdateInScope.length > 0) {
            propagateInScope(atomsToUpdateInScope, scope, isInitOnly, notify, report)
        }
    }
}

export const propagateDirtySelectors = (
    updatedAtoms: Atom[],
    selectors: Set<Selector>,
    data: StoreData,
    subscriptions: Set<Subscription>,
    families: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>,
    isInitOnly = false,
    notify?: NotifyTarget,
    // When a selector listener is active, collects every selector whose value
    // actually changed this pass, so the caller can report it via onChange.
    // Undefined on the hot path (no selector listener) — zero overhead.
    changedSelectors?: Set<Selector>,
) => {
    const updatedInitializedAtoms = new Set<Atom>(updatedAtoms)
    if (selectors.size > 0) {
        // At this point we have the first level of selectors that are dependent on
        // the atoms that changed. We now traverse the tree of selectors and collect
        // subscribers to those that change.
        propagateSelectorUpdates(
            selectors,
            data,
            subscriptions,
            updatedInitializedAtoms,
            isInitOnly,
            changedSelectors,
        )
    }
    // When deferring (multi-pass commit), the caller owns `subscriptions` /
    // `families` and fires them once after every pass has run.
    if (!notify && subscriptions.size > 0) {
        callSubscribers(subscriptions, families)
    }
}


// Topological evaluation of a downstream subgraph. Each selector in
// `seeds` (and everything transitively reachable from them) is re-evaluated
// at most once, in dependency order. The seeds are direct dependents of
// initial selectors whose values just changed in the first sweep — i.e.
// "level-2" selectors. We only enter the topo path when there's actual
// downstream work, since the bookkeeping (closure + pending count) is
// material relative to a simple BFS pass.
const propagateDownstreamTopo = (
    seeds: Set<Selector>,
    data: StoreData,
    collectedSubscribers: Set<any>,
    updatedInitializedAtoms: Set<Atom>,
    isInitOnly: boolean,
    changedSelectors?: Set<Selector>,
) => {
    const closure = new Set<Selector>(seeds)
    {
        const stack: Selector[] = [...seeds]
        while (stack.length > 0) {
            const s = stack.pop() as Selector
            const downstream = data.stateDependents.get(s)
            if (downstream) {
                for (const d of downstream) {
                    if (!closure.has(d)) {
                        closure.add(d)
                        stack.push(d)
                    }
                }
            }
        }
    }

    // Pending: number of direct deps of `s` that are also in the closure
    // (i.e. still-dirty parents). Count 0 → ready to evaluate. Atoms and
    // out-of-closure selectors are already resolved (atoms were just
    // updated; outside selectors are stable for this propagation).
    const pending = new Map<Selector, number>()
    const ready: Selector[] = []
    for (const s of closure) {
        const deps = data.stateDependencies.get(s)
        let count = 0
        if (deps) {
            for (const d of deps) {
                if (closure.has(d as Selector)) count++
            }
        }
        pending.set(s, count)
        if (count === 0) ready.push(s)
    }
    // A closure member only needs re-evaluation if at least one of its
    // upstream parents actually changed value. Seeds reach here because
    // a first-pass parent changed, so they start as needing eval. Pure
    // downstream gets flagged as parents propagate change.
    const needsEval = new Set<Selector>(seeds)

    // Each selector is evaluated AT MOST ONCE in this topo walk. The `pending`
    // counter is only a snapshot — under dynamic deps the live `stateDependents`
    // that `advance` walks diverges from it (an evaluation that adds an edge to
    // an already-counted parent makes that parent decrement this node twice),
    // driving the count negative and re-pushing the node once per extra parent.
    // For a wide-fan-in aggregator that is ~once per dependency — the 1.0.0-beta
    // re-evaluation blow-up. To cap every node at one evaluation, a finalized
    // node is DELETED from `pending`: a closure member with no `pending` entry is
    // "settled" (`closure.has(s) && !pending.has(s)`), which `advance` and the
    // pop loop both check to skip it. Reusing `pending` this way avoids a second
    // per-walk Set allocation on the propagation hot path. The rare genuine
    // re-evaluation a graph mutation demands (a parent that settled to a new
    // value out of topological order) is delegated to the fixpoint sweep below
    // via `resweep`, which re-settles it (and its dependents) a bounded number
    // of times instead.

    // Set when the dependency graph changes during the walk (a selector's deps
    // were added/removed, or an out-of-closure dependent was pulled in). Only
    // then can a node need the settle scan below, so the steady-state fast path
    // skips it entirely.
    let graphMutated = false

    // Selectors that had already settled when one of their parents settled to a
    // NEW value after them, so the topo `advance` could not reach them (it skips
    // settled nodes to avoid the re-eval blow-up). In a clean topological order a
    // parent always settles before its child, so this stays empty; it fills only
    // when the graph mutated under the walk and a parent materialized/changed out
    // of order (e.g. an orphan lazily re-initialized mid-walk). Handed to the
    // fixpoint sweep below for a bounded re-settle.
    let resweep: Set<Selector> | undefined

    const advance = (selector: Selector, propagateChange: boolean) => {
        const downstream = data.stateDependents.get(selector)
        if (!downstream) return
        for (const d of downstream) {
            if (!closure.has(d)) {
                // `d` is downstream of a just-changed selector but absent from
                // the static closure, which means it was materialized AFTER the
                // closure was built — e.g. an orphaned selector whose value was
                // dropped by unsubscribe GC and then lazily re-initialized when
                // a closure selector read it mid-propagation. Such a node may
                // have read a not-yet-settled (stale) value of `selector`, and
                // because it's untracked, a later change here would never reach
                // it. Pull it into the closure so the topo walk re-evaluates it
                // once `selector` settles. (Only when there is an actual change
                // to propagate; an unchanged parent needs no re-eval.)
                if (propagateChange) {
                    graphMutated = true
                    closure.add(d)
                    pending.set(d, 0)
                    needsEval.add(d)
                    ready.push(d)
                }
                continue
            }
            const cur = pending.get(d)
            if (cur === undefined) {
                // `d` is in the closure but has no `pending` entry → already
                // settled. If `selector` changed value AFTER `d` settled, `d`
                // computed against a stale input and must re-settle — but
                // re-pushing it into this walk is exactly the per-parent re-eval
                // blow-up the once-per-walk cap exists to prevent. Hand it to the
                // fixpoint sweep instead. Only reachable under graph mutation
                // (parents settle in topological order otherwise), so the
                // wide-fan-in hot path never gets here.
                if (propagateChange) {
                    graphMutated = true
                    ;(resweep ??= new Set()).add(d)
                }
                continue
            }
            const c = cur - 1
            pending.set(d, c)
            if (propagateChange) needsEval.add(d)
            // `c < 0` is possible when dynamic deps desynced the snapshot from
            // the live graph; the settled check above makes the redundant
            // re-push a no-op pop.
            if (c <= 0) ready.push(d)
        }
    }

    // FIFO head pointer preserves the original BFS sibling order — nested
    // writes that side-effect into peer selectors during eval depend on it.
    // Reused across every re-evaluated selector. evaluateSelector only
    // allocates the inner Sets when deps actually changed, so steady-state
    // settling does zero allocation here.
    const depsChange: DepsChange = {}
    let head = 0
    while (head < ready.length) {
        const selector = ready[head++]

        // Evaluated already this walk (no `pending` entry) — a node can be
        // re-queued by a later advance (a desynced `pending` going negative, or
        // a re-pushed orphan). Finalizing deletes the entry; the skip is here.
        if (!pending.has(selector)) continue

        const currentValue = data.values.get(selector)

        if (isPromiseLike(currentValue) && isInitOnly) {
            pending.delete(selector)
            advance(selector, false)
            continue
        }

        if (!needsEval.has(selector)) {
            pending.delete(selector)
            advance(selector, false)
            continue
        }

        const dependents = data.stateDependents.get(selector)
        const subscribers = data.subscriptions.get(selector)

        if (
            !isPromiseLike(currentValue) &&
            (!dependents || dependents.size === 0) &&
            (!subscribers || subscribers.size === 0)
        ) {
            // No live consumer — invalidate for lazy re-eval on next read.
            data.values.delete(selector)
            pending.delete(selector)
            advance(selector, false)
            continue
        }

        depsChange.added = undefined
        depsChange.removed = undefined
        const wasValueUpdated = reEvaluateSelector(
            selector,
            data,
            updatedInitializedAtoms,
            depsChange,
            currentValue,
        )
        // Casts work around a tsgo control-flow narrowing quirk where
        // property accesses lose their narrowing after a function call.
        const added = depsChange.added as Set<State> | undefined
        const removed = depsChange.removed as Set<State> | undefined
        if (added || removed) {
            // The graph changed under the walk — a node may now be stranded.
            graphMutated = true
            if (isLive(selector, data)) {
                if (added) {
                    for (const dep of added) {
                        onLiveDependencyAdded(dep, data)
                        mountTransitiveDeps(dep, data)
                    }
                }
                if (removed) {
                    for (const dep of removed) {
                        onLiveDependencyRemoved(dep, data)
                        unmountOrphanedDeps(dep, data)
                    }
                }
            }
        }

        pending.delete(selector)
        advance(selector, wasValueUpdated)
        if (wasValueUpdated) {
            if (changedSelectors) changedSelectors.add(selector)
            if (subscribers) addSetToSet(subscribers, collectedSubscribers)
        }
    }

    // Re-settle the nodes the single-pass topo walk could not get right because
    // the dependency graph mutated under it (the `pending` counts are a snapshot
    // taken before the walk and assume a fixed graph). Two cases, both fed to the
    // dynamic topological worklist below, which re-fetches dependents as it runs
    // and is inherently robust to a graph that changed under it:
    //
    //  - STRANDED (`needsEval` but never settled, i.e. still in `pending`): a
    //    selector re-evaluated out-of-band during the walk — most commonly
    //    lazily re-initialized via getState when another selector reads it after
    //    its value was dropped by orphan-invalidation/unsubscribe — dropped a
    //    dependency it was snapshotted with. The dropped parent's reverse edge is
    //    gone, so it never decrements this node's `pending`, which stalls above
    //    0; the node is never popped and so never settles (its `pending` entry
    //    survives).
    //  - RESWEEP (settled, then a parent changed out of topological order): a
    //    node finalized, then a still-dirty parent of it settled to a new value.
    //    `advance` cannot re-push a settled node (that is the re-eval blow-up the
    //    once-per-walk cap prevents), so it queued the node here instead.
    //
    // Either way the node — and anything that read its stale value — must
    // re-settle. Guarded by `graphMutated`, so the steady-state fast path skips
    // it entirely.
    if (!graphMutated) return

    let stranded: Set<Selector> | undefined = resweep
    for (const s of closure) {
        // A node that needed eval but never settled in the walk still has its
        // `pending` entry (settling deletes it): its count never drained to 0
        // because a parent edge it was counting on was removed (truly stranded),
        // or it sits on a cycle that never reached a ready state. Re-settle it
        // here. Nodes that DID settle but were reached by an out-of-order parent
        // change come in via `resweep`.
        if (needsEval.has(s) && pending.has(s)) {
            if (!stranded) stranded = new Set()
            stranded.add(s)
        }
    }
    if (!stranded) return

    // Re-settle as a DYNAMIC TOPOLOGICAL worklist rather than depth-blind waves:
    // a node is evaluated only once none of its dependencies are themselves still
    // queued for re-settlement. That makes a wide aggregate wait for ALL its
    // upstream revisits and then run exactly once, instead of once per wave as a
    // parent settles. A re-evaluation that changes value re-queues its dependents
    // (`enqueueDownstream`). Cyclic regions have no dependency-free node, so when a
    // full scan makes no progress we fall back to evaluating the remaining set in
    // one wave — preserving the cyclic-graph settling the liveness-churn tests
    // rely on. (Topo-settle approach adapted from #209.)
    let work = stranded
    const resettled = new Set<Selector>()
    const hasUnsettledDependency = (selector: Selector) => {
        const deps = data.stateDependencies.get(selector)
        if (!deps) return false
        for (const dep of deps) {
            if (dep !== selector && work.has(dep as Selector)) return true
        }
        return false
    }
    const enqueueDownstream = (selector: Selector) => {
        const downstream = data.stateDependents.get(selector)
        if (!downstream) return
        for (const d of downstream) {
            resettled.delete(d)
            work.add(d)
        }
    }
    const evaluateStrandedSelector = (selector: Selector) => {
        const currentValue = data.values.get(selector)
        if (isPromiseLike(currentValue) && isInitOnly) return
        const dependents = data.stateDependents.get(selector)
        const subscribers = data.subscriptions.get(selector)
        if (
            !isPromiseLike(currentValue) &&
            (!dependents || dependents.size === 0) &&
            (!subscribers || subscribers.size === 0)
        ) {
            data.values.delete(selector)
            return
        }
        depsChange.added = undefined
        depsChange.removed = undefined
        const wasValueUpdated = reEvaluateSelector(
            selector,
            data,
            updatedInitializedAtoms,
            depsChange,
            currentValue,
        )
        const added = depsChange.added as Set<State> | undefined
        const removed = depsChange.removed as Set<State> | undefined
        if ((added || removed) && isLive(selector, data)) {
            if (added) {
                for (const dep of added) {
                    onLiveDependencyAdded(dep, data)
                    mountTransitiveDeps(dep, data)
                }
            }
            if (removed) {
                for (const dep of removed) {
                    onLiveDependencyRemoved(dep, data)
                    unmountOrphanedDeps(dep, data)
                }
            }
        }
        if (wasValueUpdated) {
            if (changedSelectors) changedSelectors.add(selector)
            if (subscribers) addSetToSet(subscribers, collectedSubscribers)
            // Re-fetch dependents — eval may have changed them.
            enqueueDownstream(selector)
        }
    }
    while (work.size > 0) {
        let progressed = false
        const batch = [...work]
        for (const selector of batch) {
            if (!work.has(selector)) continue
            if (hasUnsettledDependency(selector)) continue
            work.delete(selector)
            resettled.add(selector)
            progressed = true
            evaluateStrandedSelector(selector)
        }
        if (progressed) continue

        // Cyclic stranded region: no dependency-free node remains. Evaluate the
        // remaining set in one wave so cyclic dynamic graphs still settle instead
        // of stalling behind the topo gate.
        const cyclicBatch = [...work]
        work = new Set()
        for (const selector of cyclicBatch) {
            resettled.add(selector)
            evaluateStrandedSelector(selector)
        }
    }
}

const orderInitialSelectors = (
    selectors: Set<Selector>,
    data: StoreData,
): Selector[] => {
    if (selectors.size < 2) return [...selectors]

    const pending = new Map<Selector, number>()
    const downstream = new Map<Selector, Selector[]>()
    const ready: Selector[] = []

    for (const selector of selectors) {
        let count = 0
        const deps = data.stateDependencies.get(selector)
        if (deps) {
            for (const dep of deps) {
                if (!selectors.has(dep as Selector)) continue
                count++
                let list = downstream.get(dep as Selector)
                if (!list) {
                    list = []
                    downstream.set(dep as Selector, list)
                }
                list.push(selector)
            }
        }
        pending.set(selector, count)
        if (count === 0) ready.push(selector)
    }

    const ordered: Selector[] = []
    let head = 0
    while (head < ready.length) {
        const selector = ready[head++]
        ordered.push(selector)
        const children = downstream.get(selector)
        if (!children) continue
        for (const child of children) {
            const count = (pending.get(child) ?? 0) - 1
            pending.set(child, count)
            if (count === 0) ready.push(child)
        }
    }

    // Cyclic initial regions rely on the old insertion-order behavior plus the
    // liveness reconcile. Only reorder when the initial subgraph is acyclic.
    return ordered.length === selectors.size ? ordered : [...selectors]
}

const propagateSelectorUpdatesLinearFirst = (
    selectors: Set<Selector>,
    data: StoreData,
    collectedSubscribers: Set<any>,
    updatedInitializedAtoms: Set<Atom>,
    isInitOnly: boolean,
    changedSelectors?: Set<Selector>,
) => {
    let downstreamSeeds: Set<Selector> | undefined
    const orderedSelectors = orderInitialSelectors(selectors, data)
    const processedInitialSelectors = new Set<Selector>()
    // Reused across every re-evaluated selector — see propagateDownstreamTopo.
    const depsChange: DepsChange = {}
    for (const selector of orderedSelectors) {
        const currentValue = data.values.get(selector)
        if (isPromiseLike(currentValue) && isInitOnly) {
            processedInitialSelectors.add(selector)
            continue
        }
        const dependents = data.stateDependents.get(selector)
        const subscribers = data.subscriptions.get(selector)
        if (
            !isPromiseLike(currentValue) &&
            (!dependents || dependents.size === 0) &&
            (!subscribers || subscribers.size === 0)
        ) {
            // No live consumer — invalidate for lazy re-eval on next read.
            data.values.delete(selector)
            processedInitialSelectors.add(selector)
            continue
        }
        depsChange.added = undefined
        depsChange.removed = undefined
        const wasValueUpdated = reEvaluateSelector(
            selector,
            data,
            updatedInitializedAtoms,
            depsChange,
            currentValue,
        )
        // Casts work around a tsgo control-flow narrowing quirk where
        // property accesses lose their narrowing after a function call.
        const added = depsChange.added as Set<State> | undefined
        const removed = depsChange.removed as Set<State> | undefined
        if ((added || removed) && isLive(selector, data)) {
            if (added) {
                for (const dep of added) {
                    onLiveDependencyAdded(dep, data)
                    mountTransitiveDeps(dep, data)
                }
            }
            if (removed) {
                for (const dep of removed) {
                    onLiveDependencyRemoved(dep, data)
                    unmountOrphanedDeps(dep, data)
                }
            }
        }
        processedInitialSelectors.add(selector)
        if (!wasValueUpdated) continue
        if (changedSelectors) changedSelectors.add(selector)
        if (subscribers) addSetToSet(subscribers, collectedSubscribers)
        // Re-fetch dependents — eval may have changed them.
        const downstream = data.stateDependents.get(selector)
        if (downstream && downstream.size > 0) {
            if (!downstreamSeeds) downstreamSeeds = new Set()
            for (const d of downstream) {
                if (selectors.has(d) && !processedInitialSelectors.has(d)) {
                    continue
                }
                downstreamSeeds.add(d)
            }
        }
    }

    if (downstreamSeeds && downstreamSeeds.size > 0) {
        propagateDownstreamTopo(
            downstreamSeeds,
            data,
            collectedSubscribers,
            updatedInitializedAtoms,
            isInitOnly,
            changedSelectors,
        )
    }
}

// Re-evaluate the initial dirty selectors, then topologically evaluate anything
// downstream of selectors whose values actually shifted. The initial sweep is
// ordered topologically when that initial subgraph is acyclic, and a downstream
// selector already scheduled later in the same initial sweep is not queued for a
// second topo pass. Cyclic regions keep the old insertion-order behavior because
// the liveness churn tests rely on those transitional cycles being evaluated
// and reconciled by the existing backstop.
const propagateSelectorUpdates = (
    selectors: Set<Selector>,
    data: StoreData,
    collectedSubscribers: Set<any>,
    updatedInitializedAtoms: Set<Atom>,
    isInitOnly = false,
    changedSelectors?: Set<Selector>,
) => {
    if (selectors.size === 0) return

    // Own the per-pass liveness-reconcile collector. `evaluateSelector` populates
    // `data.livenessSeeds` (selectors whose dep SET changed + removed deps) and
    // arms one of two flags: `livenessRemovalArmed` (a dep was removed — gated on
    // a cycle below) or `livenessLazyArmed` (a lazy re-init committed edges
    // outside the loop — unconditional). A purely-additive loop-driven pass is
    // correct incrementally (even through cycles), so it arms neither. Allocated
    // only when a dep-set actually changes — the no-churn fast path never trips it.
    // Take ownership of the liveness collector. The loop and
    // propagateDownstreamTopo below run user onMount/cleanup (via
    // mountTransitiveDeps / unmountOrphanedDeps) that can throw, so endLivenessPass
    // runs in the `finally` (else a throwing onMount would strand the collector and
    // permanently disable the reconcile) — and the returned region is reconciled
    // AFTER the try, so a throwing pass doesn't re-enter user code and mask its
    // error.
    const ownsLivenessSeeds = beginLivenessPass(data)
    let seedsToReconcile: Set<State> | null = null
    try {
        propagateSelectorUpdatesLinearFirst(
            selectors,
            data,
            collectedSubscribers,
            updatedInitializedAtoms,
            isInitOnly,
            changedSelectors,
        )
    } finally {
        // Always release the collector — even if a user onMount/cleanup above threw
        // (see the note at the top). Returns the region to reconcile, or null.
        if (ownsLivenessSeeds) seedsToReconcile = endLivenessPass(data)
    }

    // Reconcile AFTER the owned region is released (an in-flight exception from the
    // try skips this entirely, so a throwing pass never re-enters user code here).
    if (seedsToReconcile) reconcileLivenessAfterChurn(seedsToReconcile, data)
}
