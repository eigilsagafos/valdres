// Declared at module scope (not global) so we don't conflict with a consumer's
// @types/node or bun-types — mirroring src/lib/IS_PROD.ts.
declare const process: { env: { VALDRES_ENGINE_SELF_CHECKS?: string } }

import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { AtomInput } from "../types/AtomInput"
import type { Selector } from "../types/Selector"
import type { State } from "../types/State"
import type { StoreData } from "../types/StoreData"
import type { StoreTreeRuntime } from "./storeTreeRuntime"
import type { Subscription } from "../types/Subscription"
import { isAtomFamily } from "../utils/isAtomFamily"
import { isFamilyAtom } from "../utils/isFamilyAtom"
import { isPromiseLike } from "../utils/isPromiseLike"
import {
    addFamilyAtomsToSet,
    deleteFamilyAtomsFromSet,
    recursivelyUpdateIndexes,
} from "./atomFamilyIndex"
import type { DepsChange } from "../types/DepsChange"
import { hasCommittedValue } from "./hasCommittedValue"
import { evaluateSelector, handleSelectorResult } from "./initSelector"
import {
    applyLiveDependencyDiff,
    beginLivenessPass,
    createEvaluationOutcome,
    endLivenessPass,
    hasInheritedDependencyBranches,
    installEvaluationDeps,
    reconcileLivenessAfterChurn,
    scheduleSelectors,
    SCHEDULE_CHANGED,
    SCHEDULE_GRAPH_CHANGED,
    type EvaluationOutcome,
} from "./graph"
import { recordCommitError, type CommitErrors } from "./commitErrors"
import { buildCommitForest, closeCommitBoundaries } from "./commitForest"
import { addDependentsToSet, addSetToSet } from "./collectDependents"
import {
    callSubscribers,
    collectForNotify,
    notifyDeferred,
    notifyEntryFor,
    type NotifyTarget,
} from "./notifySubscribers"
import {
    applyFamilyAdds,
    assertTreeTriggersSealed,
    collectDeletedGroup,
    collectInheritedGroup,
    collectOwnStyleGroup,
    createTreeTriggerCollector,
    firstProvenanceOf,
    mergeTreeProvenance,
    treeEqualAcrossGroups,
    TREE_GROUP_DELETED,
    TREE_GROUP_GLOBAL,
    TREE_GROUP_INHERITED,
    TREE_GROUP_UNSET,
    TREE_GROUP_UPDATED,
    type OwnStyleGroup,
    type TreeSettleContext,
    type TreeTriggerGroup,
} from "./treeTriggerGroups"
import {
    changeListenerRegistry,
    createChangeSink,
    flushChangeSink,
    hasSelectorChangeListener,
    reportAtomChanges,
    reportDeletedAtoms,
    reportSelectorChanges,
    reportUnsetAtom,
    type ChangeReport,
    type ChangeSink,
} from "./notifyChangeListeners"
// Intra-cycle edge (both modules live in the recorded core SCC): the
// transaction settlement owns the unset report/re-delegate sequencing that the
// transaction's inline commit previously hand-rolled.
import {
    effectiveValueAfterUnset,
    reDelegateScopeSubscriptions,
} from "./unsetValue"
import type {
    CommitForestEntry,
    CommitForestSettleFn,
} from "../types/CommitForestSettleFn"
import { beginCommit, commitEndRegistry, endCommit } from "./onCommitEnd"
import { setValueInData } from "./setValueInData"
import { noteStateValueChanged } from "./stateRevisions"
import {
    recordSelectorSettlement,
    recordStoreSettlement,
} from "./architectureInstrumentation"
import { IS_PROD } from "./IS_PROD"
import { stateNameSuffix } from "./stateNameForError"
import type { SettleFlags } from "../types/SettleFlags"
import type { SelectorSettleFn } from "../types/SelectorSettleFn"

// Settlement: everything that happens after a commit's writes have landed —
// re-evaluate the dirty selector closure, fan out into scopes, deliver
// subscribers, emit change reports, and close the commit boundary.
//
// This module keeps the concerns that cannot leave it without joining the core
// write-path import cycle: they need `initSelector` (the evaluator) or
// `unsetValue`, both of which import back here (see test/import-cycles). The
// concerns that CAN stand alone are owned by leaf modules and imported above:
//
//   - `notifySubscribers.ts`  — the deferred `NotifyTarget` and subscriber
//                               delivery.
//   - `treeTriggerGroups.ts`  — the cross-scope reaching-group model, its
//                               phase-A collector, and the group-sequential
//                               `equal` contract.
//   - `commitForest.ts`       — forest canonicalization and commit-boundary
//                               closing.
//   - `collectDependents.ts`  — the instrumented set-union primitives.
//
// Graph tables are never mutated here: every edge/liveness write goes through
// `graph/`, which owns them exclusively.

const reEvaluateSelector = (
    selector: Selector,
    data: StoreData,
    updatedAtoms: Set<Atom>,
    depsChange: DepsChange,
    outcome: EvaluationOutcome,
    existingValue: unknown,
    treeCtx?: TreeSettleContext,
): boolean => {
    if (!IS_PROD && data.architectureInstrumentation)
        recordSelectorSettlement(selector, data)
    try {
        const rawValue = evaluateSelector(
            selector,
            data,
            updatedAtoms,
            undefined,
            true,
            outcome,
        )
        // The carrier is owned per PASS (like the reusable depsChange), not
        // per re-eval: the evaluator overwrites every field before returning
        // and the install consumes them immediately, so the steady-state loop
        // pays no pool traffic. Passing the loop's depsChange keeps the
        // lazy-arm OFF for loop-driven re-evals: their dependency diff is
        // applied incrementally by the caller via applyLiveDependencyDiff.
        if (outcome.needsInstall) {
            installEvaluationDeps(
                selector,
                data,
                outcome.deps!,
                outcome.prevDeps,
                true,
                outcome.isAsync,
                depsChange,
            )
        }
        // This evaluator is reached from the committed reverse graph; cold
        // selectors are deliberately absent from that graph. Passing the known
        // mode avoids a second WeakSet lookup for every propagated selector.
        const updatedValue = handleSelectorResult(
            rawValue,
            selector,
            data,
            undefined,
            true,
        )

        // Same presence rule as initSelector's, for the same reason: on this
        // path a MISSING entry means the previous evaluation threw (see the
        // catch below, which drops the value). Treating that absence as a
        // committed `undefined` both leaves the selector unmemoized and stops
        // propagation, so a subscriber never learns the error cleared.
        // `existingValue` is the caller's own `data.values.get(selector)`
        // (settleScheduledSelector), so it carries the presence question here
        // too.
        const hasExistingValue = hasCommittedValue(
            selector,
            data,
            existingValue,
        )

        // Gating rather than post-filtering (see hasCommittedValue) is what
        // keeps every comparator — the selector's own AND each one
        // `treeEqualAcrossGroups` invokes per provenance group — out of the
        // absent-sentinel position. Otherwise a recovery from a throwing
        // evaluation calls `equal(undefined, recovered)`, a comparator like
        // `(a, b) => a.id === b.id` throws, the catch below drops the recovered
        // value again, and the selector never escapes the error state.
        // Promises use reference equality — deep equal treats all promises as
        // structurally identical (both have zero own keys).
        const areEqual =
            hasExistingValue &&
            (isPromiseLike(existingValue) || isPromiseLike(updatedValue)
                ? existingValue === updatedValue
                : treeCtx === undefined
                  ? selector.equal(existingValue, updatedValue, updatedAtoms)
                  : treeEqualAcrossGroups(
                        treeCtx,
                        selector,
                        existingValue,
                        updatedValue,
                        updatedAtoms,
                    ))
        if (areEqual) return false
        setValueInData(selector, updatedValue, data)
        return true
    } catch {
        if (data.values.delete(selector)) {
            noteStateValueChanged(selector, data)
        }
        return true
    }
}

const settleDeletedAtoms = (
    atoms: AtomFamilyAtom<any, any>[],
    data: StoreData,
    subscriptions: Set<Subscription> = new Set(),
    // Per-call ONLY (never a cross-pass accumulator): the family atoms deleted
    // in THIS call. Drives deletion bookkeeping (deleteFamilyAtomsFromSet) and
    // is merged into notify.families afterwards for deferred notification. See
    // notifySubscribers.ts for why bookkeeping and notification must not
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
    let commitTree: StoreTreeRuntime | undefined
    if (commitEndRegistry.count !== 0) commitTree = beginCommit(data)
    let completed = false
    try {
        // Reuse an entry from an earlier pass. The first pass stays local until
        // it actually finds a subscriber, avoiding empty per-scope entries.
        const notifyEntry = notify?.get(data)
        if (notifyEntry) {
            subscriptions = notifyEntry.subscriptions
        }
        const selectors = new Set<Selector>()
        for (const atom of atoms) {
            addDependentsToSet(data.stateDependents.get(atom), selectors, data)
            addSetToSet(data.subscriptions.get(atom), subscriptions)

            if (isFamilyAtom(atom)) {
                if (!deletedFamilyAtoms.has(atom.family)) {
                    deletedFamilyAtoms.set(atom.family, new Set())
                }
                // @ts-expect-error -- the immediately preceding insertion proves this family set exists
                deletedFamilyAtoms.get(atom.family).add(atom)
            }
        }
        if (deletedFamilyAtoms.size > 0) {
            for (const [family, familyAtoms] of deletedFamilyAtoms) {
                addDependentsToSet(
                    data.stateDependents.get(family),
                    selectors,
                    data,
                )
                addSetToSet(data.subscriptions.get(family), subscriptions)
                if (
                    !IS_PROD &&
                    process.env.VALDRES_ENGINE_SELF_CHECKS !== "off" &&
                    familyAtoms.size === 0
                ) {
                    throw new Error(
                        `valdres: delete propagation collected an empty member set for atomFamily${stateNameSuffix(family)} in store '${data.id}'`,
                    )
                }

                deleteFamilyAtomsFromSet(family, familyAtoms, data, timestamp)
            }
        }
        // A deleted member changes both its own value and family membership.
        // Include family objects before deciding whether any scope branch is
        // affected; a scope selector may observe only get(family), not member.
        const scopeAtoms: AtomInput[] = atoms.slice()
        for (const family of deletedFamilyAtoms.keys()) {
            if (!scopeAtoms.includes(family)) scopeAtoms.push(family)
        }
        const hasScopeCascade = hasInheritedDependencyBranches(scopeAtoms, data)
        // An immediate store-tree propagation still needs a deferred notify
        // phase: every affected descendant selector must settle before the
        // first root callback can observe (or interrupt) the tree. Keep the
        // allocation off both the single-store and idle-scope paths.
        const localNotify: NotifyTarget | undefined =
            notify === undefined && hasScopeCascade ? new Map() : undefined
        const effectiveNotify = notify ?? localNotify
        // `selectorCount` is the cheap global short-circuit; `hasSelectorChangeListener`
        // then confirms a selector listener actually exists on THIS store's ancestor
        // chain, so an unrelated root store with a selector listener doesn't make this
        // one pay for selector collection.
        const selectorActive =
            report !== undefined &&
            changeListenerRegistry.selectorCount !== 0 &&
            hasSelectorChangeListener(data)
        const changedSelectors = selectorActive
            ? new Set<Selector>()
            : undefined
        propagateDirtySelectors(
            atoms,
            selectors,
            data,
            subscriptions,
            deletedFamilyAtoms,
            false,
            effectiveNotify,
            changedSelectors,
        )
        if (effectiveNotify)
            collectForNotify(
                effectiveNotify,
                data,
                subscriptions,
                deletedFamilyAtoms,
            )
        const watching =
            report !== undefined && changeListenerRegistry.count !== 0

        // When any selector listener exists and this delete cascades into scopes,
        // the origin group + each scope's selector group must coalesce behind the
        // tree's subscriber notify phase. A listener may live only in a descendant
        // (and therefore be invisible to selectorActive's ancestor walk), so use the
        // O(1) global gate rather than scanning the scope tree. The txn path already
        // passes a sink. (Mirror of the wrap in settleCommit.)
        let localSink: ChangeSink | undefined
        let effectiveReport: ChangeReport | undefined = report
        if (
            hasScopeCascade &&
            typeof report === "string" &&
            changeListenerRegistry.selectorCount !== 0
        ) {
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
            reportDeletedAtoms(
                atoms,
                data,
                effectiveReport as ChangeReport,
                changedSelectors,
            )

        // Cross-propagate the deletion into descendant scopes, mirroring the update
        // path (settleCommit → propagateToScopes), and thread `effectiveReport`
        // so the scoped selector recomputes are reported too. deleteFamilyAtomsFromSet
        // already re-rendered each shadowing scope's family index; this re-evaluates
        // the dependent selectors so their subscribers fire. Two kinds of scope
        // dependent are reached: a scope that merely INHERITS the deleted member and
        // reads it directly (get(family("a"))), and a non-shadowing scope whose
        // selector reads the family list (get(family)). Members skip scopes that
        // shadow them (visible value unchanged); families always propagate.
        if (hasScopeCascade) {
            propagateToScopes(
                scopeAtoms,
                data,
                false,
                effectiveNotify,
                effectiveReport,
            )
        }

        if (localNotify) notifyDeferred(localNotify)
        if (watching && !reportIsSink)
            reportDeletedAtoms(
                atoms,
                data,
                effectiveReport as ChangeReport,
                changedSelectors,
            )
        if (localSink) flushChangeSink(localSink)
        completed = true
    } finally {
        if (commitTree !== undefined) endCommit(commitTree, !completed)
    }
}

/** Typed commit-engine entry for a local family-member deletion. The positional
 * primitive remains for transaction adapters; migrated direct deletion passes
 * this function reference through its CommitPlan. */
export const settleDeletedCommit = (
    atoms: AtomFamilyAtom<any, any>[],
    data: StoreData,
    notify: NotifyTarget | undefined,
    report: ChangeReport | undefined,
) =>
    settleDeletedAtoms(
        atoms,
        data,
        undefined,
        undefined,
        undefined,
        notify,
        report,
    )

// Top-level entry: collect direct atom subscribers, walk dependent selectors,
// then cross-propagate into scopes. A scoped immediate update notifies only
// after the full affected tree has settled.
//
// `notify` (multi-pass commit only): see NotifyTarget. When provided, subscribers
// are collected into it instead of fired, so the commit can fire them once at
// the end. An immediate update that reaches scopes creates its own target, settles
// the whole store tree, then fires it. The single-store / non-scoped hot path
// stays inline and allocation-free with respect to deferred notification.
export const settleCommit = (
    atoms: AtomInput[],
    data: StoreData,
    notify: NotifyTarget | undefined,
    report: ChangeReport | undefined,
    flags: SettleFlags,
) => {
    const { isInitOnly, skipFamilyIndexUpdate, reportAtoms } = flags
    // Commit boundary for store.onCommitEnd. With no listener anywhere this
    // is a single global counter read on the Bencher-gated propagation hot
    // path — no tracking, no allocation, no extra call frame. When listeners
    // exist, the OUTERMOST boundary fires them exactly once, after every
    // subscriber callback; boundaries opened while another is in flight (a
    // transaction's per-store passes, a write from inside a subscriber) only
    // move the tree's depth counter. On a throw the listeners still fire
    // (writes were applied) but their own errors are swallowed so they never
    // mask the original failure.
    let commitTree: StoreTreeRuntime | undefined
    if (commitEndRegistry.count !== 0) commitTree = beginCommit(data)
    let completed = false
    try {
        // Keep the no-scope gate at this call site even though the helper also
        // checks it. Avoiding that call keeps large scope-free transactions on
        // V8's optimized path (Node 22 otherwise falls off a severe perf cliff).
        const hasScopeCascadeForInputs =
            data.scopes.size !== 0 &&
            hasInheritedDependencyBranches(atoms, data)
        // Fast path: single non-family atom with no dependent selectors and no
        // affected scope branch can skip the full graph walk entirely and just
        // notify subscribers. Merely having idle scopes no longer defeats it.
        if (atoms.length === 1) {
            const atom = atoms[0]
            if (!isFamilyAtom(atom) && !isAtomFamily(atom)) {
                const dependents = data.stateDependents.get(atom)
                if (
                    (!dependents || dependents.size === 0) &&
                    !hasScopeCascadeForInputs
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
                        if (notify)
                            addSetToSet(
                                subs,
                                notifyEntryFor(notify, data).subscriptions,
                            )
                        else callSubscribers([...subs])
                    }
                    // No dependents here, so there are no selectors to report; only
                    // the atom would be, and only when reportAtoms is set.
                    if (
                        reportAtoms &&
                        report !== undefined &&
                        changeListenerRegistry.count !== 0 &&
                        !isInitOnly
                    ) {
                        reportAtomChanges(atoms, data, report)
                    }
                    completed = true
                    return
                }
            }
        }

        const notifyEntry = notify?.get(data)
        const subscriptions = notifyEntry
            ? notifyEntry.subscriptions
            : new Set<Subscription>()
        // Per-call ONLY (never a cross-pass accumulator): the family atoms updated
        // in THIS call. Drives index bookkeeping (addFamilyAtomsToSet), and is
        // merged into notify.families afterwards for deferred notification — two
        // roles, kept in one local map because within a single pass they are the
        // same data. See notifySubscribers.ts for why they must not share a
        // map across passes.
        const updatedFamilyAtoms = new Map<
            AtomFamily<any>,
            Set<AtomFamilyAtom<any>>
        >()
        const selectors = new Set<Selector>()

        for (const atom of atoms) {
            addDependentsToSet(data.stateDependents.get(atom), selectors, data)
            addSetToSet(data.subscriptions.get(atom), subscriptions)
            if (isFamilyAtom(atom) && !skipFamilyIndexUpdate) {
                if (!updatedFamilyAtoms.has(atom.family)) {
                    updatedFamilyAtoms.set(atom.family, new Set())
                }
                // @ts-expect-error -- the immediately preceding insertion proves this family set exists
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
                // Family subscriptions are member-change subscriptions: they
                // still fire for value-only writes with the changed member's
                // args. Selectors that read the family object, however, depend
                // only on membership and should run only when its list changes.
                addSetToSet(data.subscriptions.get(family), subscriptions)
                if (
                    !IS_PROD &&
                    process.env.VALDRES_ENGINE_SELF_CHECKS !== "off" &&
                    familyAtoms.size === 0
                ) {
                    throw new Error(
                        `valdres: update propagation collected an empty member set for atomFamily${stateNameSuffix(family)} in store '${data.id}'`,
                    )
                }
                if (addFamilyAtomsToSet(family, familyAtoms, data, timestamp)) {
                    addDependentsToSet(
                        data.stateDependents.get(family),
                        selectors,
                        data,
                    )
                    if (!membershipChanged) membershipChanged = new Set()
                    membershipChanged.add(family)
                }
            }
        }

        // A family object is scope-relevant only when membership changed. A
        // value-only member update stays on the member's branch index.
        let scopeAtoms: AtomInput[] = atoms
        if (membershipChanged) {
            scopeAtoms = atoms.slice()
            for (const family of membershipChanged) {
                if (!scopeAtoms.includes(family)) scopeAtoms.push(family)
            }
        }
        const hasScopeCascade =
            membershipChanged === undefined
                ? hasScopeCascadeForInputs
                : hasInheritedDependencyBranches(scopeAtoms, data)

        // Scope cascades must finish before any subscriber can observe the tree
        // (or throw and interrupt it). Allocate a local target only when the
        // branch index found affected descendants; externally deferred commits
        // keep their existing target.
        const localNotify: NotifyTarget | undefined =
            notify === undefined && hasScopeCascade ? new Map() : undefined
        const effectiveNotify = notify ?? localNotify

        // A family OBJECT in `atoms` means the committed family index may be a
        // freshly cloned transaction index. Re-link shadowing child scopes so
        // their dependent selectors read that new index before evaluation.
        // This also covers transaction adds: addFamilyAtomsToSet now correctly
        // skips their already-present members instead of redundantly mutating +
        // rendering the just-committed index.
        if (data.scopes && data.scopes.size > 0) {
            for (const atom of atoms) {
                if (isAtomFamily(atom)) {
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
        const changedSelectors = selectorActive
            ? new Set<Selector>()
            : undefined
        propagateDirtySelectors(
            atoms,
            selectors,
            data,
            subscriptions,
            updatedFamilyAtoms,
            isInitOnly,
            effectiveNotify,
            changedSelectors,
        )
        if (effectiveNotify)
            collectForNotify(
                effectiveNotify,
                data,
                subscriptions,
                updatedFamilyAtoms,
            )

        const watching =
            report !== undefined &&
            changeListenerRegistry.count !== 0 &&
            !isInitOnly

        // When any selector listener exists and this update cascades into scopes,
        // the origin group (atoms + its selectors) and each descendant scope's
        // selector group must coalesce behind the tree's subscriber notify phase.
        // A listener may live only in a descendant (and therefore be invisible to
        // selectorActive's ancestor walk), so use the O(1) global gate rather than
        // scanning the scope tree. The txn path already passes a sink. With no
        // selector listener there's only ever the one origin group, so the string
        // report fires it inline exactly as before.
        let localSink: ChangeSink | undefined
        let effectiveReport: ChangeReport | undefined = report
        if (
            hasScopeCascade &&
            typeof report === "string" &&
            changeListenerRegistry.selectorCount !== 0
        ) {
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
        if (watching && reportIsSink)
            emitOrigin(effectiveReport as ChangeReport)
        if (hasScopeCascade) {
            // A scope selector that reads get(family) depends on the FAMILY object,
            // not the individual member atoms. When the parent's MEMBERSHIP changes (a
            // member added/removed), propagating only the changed members into scopes
            // (as `atoms` holds) re-renders each scope's family index via
            // recursivelyUpdateIndexes above but never re-evaluates those selectors —
            // leaving them stale. So mirror the delete settlement path
            // pushes the family onto its scopeAtoms): also propagate each family whose
            // membership changed. A pure member VALUE-update (membership unchanged) is
            // deliberately NOT included — its scope-side effect reaches selectors via
            // the member atom already in `atoms`, so it keeps the single-atom scope
            // fast path. That gate is `membershipChanged`.
            propagateToScopes(
                scopeAtoms,
                data,
                isInitOnly,
                effectiveNotify,
                effectiveReport,
            )
        }
        if (localNotify) notifyDeferred(localNotify)
        if (watching && !reportIsSink)
            emitOrigin(effectiveReport as ChangeReport)
        if (localSink) flushChangeSink(localSink)
        completed = true
    } finally {
        if (commitTree !== undefined) endCommit(commitTree, !completed)
    }
}

// Settlement (phases 4–7) of any commit with cleanup mutations, global peers,
// or nested scopes: ONE root-first walk over the affected store tree. Each
// store is visited exactly once and settled against the union of its own
// updated/deleted/unset writes and every inherited change that reaches it, so a
// selector evaluates at most once per (store, commit) — the proven-safe
// replacement for the historical one-propagation-pass-per-store model (see the
// NotifyTarget warning in notifySubscribers.ts: this is a visit-once
// restructure behind the write-all-then-settle guarantee, not a skip guard;
// nothing is deduplicated away, work is simply not repeated).
//
// A non-global single-store transaction is simply the degenerate forest: one
// entry, one root, no descent. Its update/delete/unset triggers are three
// groups on the SAME node rather than three sequential passes over it, so the
// mutation KIND no longer decides how many times a store settles.
//
// Global peers (already written in the write phase) bracket the walk with the
// exact sequencing the transaction commit previously hand-rolled inline: peer
// propagation first (their fan-out retains its public direct-set metadata and
// precedes the originating transaction's reports), one deferred notify for
// peers + tree together, global sink flush, then the peer trees' commit-end
// boundaries. Unset re-delegation runs strictly last — the deferred
// scope-local callback idempotently drops its delegate, so the fresh parent
// delegate must be (re)established after firing.
//
// Error contract: each store's settlement and reporting record into `errors`
// and the walk continues — one store failing must not starve later stores,
// descendants, or subscriber delivery. Descent is constructed in the
// collection phase (no user code) so a throwing selector body, custom equal,
// onMount cleanup, or unset report can never hide an affected descendant.
//
// Boundary note: the caller's outer commit boundary governs; the walk opens no
// per-store boundaries (the historical inner per-pass boundaries were nested
// depth-counter no-ops). An onCommitEnd listener registered mid-commit by a
// hook therefore joins from the next commit, as on the single-store plan path.
export const settleCommitForest: CommitForestSettleFn = (
    entries,
    globalUpdates,
    globalSource,
    report,
    errors,
) => {
    const forest = buildCommitForest(entries, globalUpdates)
    const notify: NotifyTarget = new Map()
    const globalSink = globalUpdates
        ? createChangeSink(undefined, globalSource ?? "set")
        : undefined
    const localSink =
        typeof report === "string"
            ? createChangeSink(undefined, report)
            : undefined
    const effectiveReport = localSink ?? report
    const commitTrees: StoreTreeRuntime[] = []
    if (commitEndRegistry.count !== 0) {
        for (const root of forest.roots)
            commitTrees.push(beginCommit(root.data))
    }
    const timestamp = performance.now()
    // The settlement walk is the ONLY region here that can throw past the
    // boundary close below: its collection phases run before any error
    // accumulator exists, while every step after it carries its own try/catch.
    // A boundary left open strands the tree's depth counter and silences
    // onCommitEnd for that whole tree, permanently — so release in the catch
    // and rethrow, which keeps the common (no-listener) path free of a
    // try/finally wrapping the whole body.
    try {
        for (const root of forest.roots) {
            settleTreeStore(
                root,
                root.data,
                undefined,
                forest.peerAtoms,
                globalSink,
                notify,
                effectiveReport,
                errors,
                timestamp,
            )
        }
    } catch (error) {
        // The commit is already failing, so listener errors are swallowed —
        // they must never mask this one.
        closeCommitBoundaries(commitTrees, errors, true)
        throw error
    }
    // Preserve the locked cross-store observer contract: changed peers precede
    // local/origin stores. Remaining inherited-only scope entries retain their
    // forest-walk insertion order.
    const orderedNotify: NotifyTarget = new Map()
    const appendNotify = (data: StoreData) => {
        const entry = notify.get(data)
        if (entry && !orderedNotify.has(data)) orderedNotify.set(data, entry)
    }
    if (globalUpdates)
        for (const peer of globalUpdates.keys()) appendNotify(peer)
    for (const entry of entries) appendNotify(entry.data)
    for (const [data, entry] of notify) {
        if (!orderedNotify.has(data)) orderedNotify.set(data, entry)
    }
    try {
        notifyDeferred(orderedNotify)
    } catch (error) {
        recordCommitError(errors, error)
    }
    if (globalSink) {
        try {
            flushChangeSink(globalSink)
        } catch (error) {
            recordCommitError(errors, error)
        }
    }
    if (localSink) {
        try {
            flushChangeSink(localSink)
        } catch (error) {
            recordCommitError(errors, error)
        }
    }
    // Re-delegate AFTER firing: the deferred scope-local callback idempotently
    // drops its delegate, so the fresh parent delegate is established last.
    for (const entry of entries) {
        if (entry.unsetAtoms) {
            for (const atom of entry.unsetAtoms) {
                try {
                    reDelegateScopeSubscriptions(atom, entry.data)
                } catch (error) {
                    recordCommitError(errors, error)
                }
            }
        }
        // A reverted family index is a pass-through, so the scope no longer
        // shadows the family's membership and its family subscriptions must
        // track the parent again — the same re-arm the unset atoms above get,
        // and for the same reason: the scope stopped owning the state.
        if (entry.familyIndexReverts) {
            for (const family of entry.familyIndexReverts) {
                try {
                    reDelegateScopeSubscriptions(family as any, entry.data)
                } catch (error) {
                    recordCommitError(errors, error)
                }
            }
        }
    }
    closeCommitBoundaries(commitTrees, errors, errors.hasError)
}

/** Per-store visit of the cross-scope settlement walk. Three phases:
 *   A) collection + index bookkeeping + descent construction — no user code,
 *      so the descent set exists even when a later phase throws;
 *   B) one dirty-selector settlement against the union of every trigger, with
 *      per-selector reaching-group provenance threaded through the dependency
 *      graph for the public `equal` contract (see treeEqualAcrossGroups);
 *   C) causal assembly: deferred subscribers are inserted and reports emitted
 *      in reaching-group order — a selector first reached by an inherited (or
 *      global-peer) trigger keeps its historical position BEFORE the store's
 *      own-atom entries, and peer-originated groups keep reporting into the
 *      global sink.
 * Then recurse into children (plan entries ∪ branch-index scopes), root-first,
 * each child receiving the group-structured subset of triggers that reach it. */
const settleTreeStore = (
    entry: CommitForestEntry | undefined,
    data: StoreData,
    inheritedGroups: TreeTriggerGroup[] | undefined,
    foldedPeerAtoms: Map<StoreData, Atom[]> | undefined,
    globalSink: ChangeSink | undefined,
    notify: NotifyTarget,
    report: ChangeReport | undefined,
    errors: CommitErrors,
    timestamp: number,
) => {
    // ---- Phase A: collection + bookkeeping (no user code) ----
    // One collector owns everything a later phase reads: the reaching-pass
    // groups with their parallel direct-subscriber and membership-change slots,
    // the per-selector provenance, the first-level dirty selectors, and the
    // static trigger union. `treeTriggerGroups.ts` documents the phase contract
    // and enforces it — the arrays can only grow through `pushTreeGroup`, and
    // phase B receives the collector narrowed to `TreeSettleContext`, whose
    // groups and base union are readonly.
    const collector = createTreeTriggerCollector()

    const peerAtoms = foldedPeerAtoms?.get(data)

    // Each own-style group is kept as the object its collection returned, not
    // as a bare index: the follow-up steps that read the group's `directSubs`
    // slot (family adds, value descent) accept only that object, so they cannot
    // be aimed at a group that has no slot.
    let peerGroup: OwnStyleGroup | undefined
    let updatedGroup: OwnStyleGroup | undefined
    let deletedGroup: OwnStyleGroup | undefined
    let unsetGroup: OwnStyleGroup | undefined
    let initGroup: OwnStyleGroup | undefined

    // The folded global-peer group comes FIRST: the historical global loop
    // propagated every peer before any per-store transaction pass.
    if (peerAtoms) {
        peerGroup = collectOwnStyleGroup(collector, data, {
            kind: TREE_GROUP_GLOBAL,
            atoms: peerAtoms,
            set: undefined,
            report: globalSink,
        })
        if (peerGroup.familyAtoms)
            applyFamilyAdds(collector, data, peerGroup, timestamp)
    }

    if (inheritedGroups) {
        for (const group of inheritedGroups)
            collectInheritedGroup(collector, data, group)
    }

    const ownUpdated =
        entry !== undefined && entry.updatedAtoms.length > 0
            ? entry.updatedAtoms
            : undefined
    const ownDeleted = entry?.deleted
    const ownUnset =
        entry?.unsetAtoms !== undefined && entry.unsetAtoms.length > 0
            ? entry.unsetAtoms
            : undefined

    if (ownUpdated) {
        updatedGroup = collectOwnStyleGroup(collector, data, {
            kind: TREE_GROUP_UPDATED,
            atoms: ownUpdated,
            set: undefined,
            report: undefined,
        })
        if (updatedGroup.familyAtoms)
            applyFamilyAdds(collector, data, updatedGroup, timestamp)
        // Committed family indexes may be freshly cloned transaction indexes:
        // re-link shadowing child scopes before any evaluation (theirs happens
        // later in the walk, but the delete bookkeeping below also reads them).
        if (data.scopes.size > 0) {
            for (const atom of ownUpdated) {
                if (isAtomFamily(atom)) {
                    recursivelyUpdateIndexes(data, atom)
                }
            }
        }
    }

    if (ownDeleted) {
        deletedGroup = collectDeletedGroup(
            collector,
            data,
            {
                kind: TREE_GROUP_DELETED,
                atoms: ownDeleted,
                set: undefined,
                report: undefined,
            },
            timestamp,
        )
    }

    if (ownUnset) {
        unsetGroup = collectOwnStyleGroup(collector, data, {
            kind: TREE_GROUP_UNSET,
            atoms: ownUnset,
            set: undefined,
            report: undefined,
        })
        if (unsetGroup.familyAtoms)
            applyFamilyAdds(
                collector,
                data,
                unsetGroup,
                timestamp,
                entry!.unsetMembershipDrops,
            )
    }

    // Membership changes from `unsetAll` reverting this store's family index
    // that no other group carries — in practice the members coming BACK (a
    // scope-local `del` undone), which have no value write anywhere, so without
    // this their family's subscribers never learn the membership changed. The
    // members that LEFT are deliberately absent: the revert unset their values,
    // so the unset group above already notifies and reports them. Collected as
    // its own group so its subscribers and its report keep the revert's own
    // provenance; the index itself is already final (the write phase reset it),
    // so nothing is registered here.
    let memberDeltaGroup: OwnStyleGroup | undefined
    const familyMemberDelta = entry?.familyMemberDelta
    if (familyMemberDelta) {
        const deltaAtoms: Atom[] = []
        for (const members of familyMemberDelta.values()) {
            for (const member of members) deltaAtoms.push(member)
        }
        if (deltaAtoms.length > 0) {
            memberDeltaGroup = collectOwnStyleGroup(collector, data, {
                kind: TREE_GROUP_UNSET,
                atoms: deltaAtoms,
                set: undefined,
                report: undefined,
            })
            const subs = collector.directSubs[memberDeltaGroup.index]!
            for (const family of familyMemberDelta.keys()) {
                addSetToSet(data.subscriptions.get(family), subs)
            }
        }
    }

    // Lazily-initialized members settle like an ordinary update — register
    // membership, notify their family/member subscribers, dirty their dependent
    // selectors — but report to NOBODY: a lazy read is not a change, and the
    // direct-read path (SETTLE_INIT_ONLY) reports nothing either. The discard
    // sink is never flushed, which is what suppresses them; routing through the
    // group's existing `report` slot keeps phase C's switch untouched. Collected
    // LAST so a selector also reached by a real write keeps that write's
    // provenance (first-reached wins) and still reports through the real sink;
    // only selectors reached SOLELY by an init land in the discarded sink.
    if (entry?.initAtoms !== undefined && entry.initAtoms.length > 0) {
        initGroup = collectOwnStyleGroup(collector, data, {
            kind: TREE_GROUP_UPDATED,
            atoms: entry.initAtoms,
            set: undefined,
            report: createChangeSink(undefined, "set"),
        })
        if (initGroup.familyAtoms)
            applyFamilyAdds(collector, data, initGroup, timestamp)
        // A family OBJECT reaches this group when its index changed only because
        // a lazy read registered a member. It still carries a freshly cloned
        // transaction index, so shadowing child scopes must be re-linked exactly
        // as for an ordinary update — only its REPORTING differs.
        if (data.scopes.size > 0) {
            for (const atom of entry.initAtoms) {
                if (isAtomFamily(atom)) {
                    recursivelyUpdateIndexes(data, atom)
                }
            }
        }
    }

    // The changed family members each group contributed, read by the descent
    // (phase A) and by the notify promotion (phase C).
    const peerFamilyAtoms = peerGroup?.familyAtoms
    const updatedFamilyAtoms = updatedGroup?.familyAtoms
    const deletedFamilyAtoms = deletedGroup?.familyAtoms
    const unsetFamilyAtoms = unsetGroup?.familyAtoms
    const initFamilyAtoms = initGroup?.familyAtoms

    // Descent: plan children always; branch-index scopes for any trigger with
    // registered inherited-dependency branches. Per-child group structure
    // preserves reaching-pass granularity and each group's report sink.
    // A child mapped to `undefined` is reached with no branch-visible triggers.
    // Absence is represented by the value itself rather than a shared empty
    // array: `spreadGroup` below treats a missing/undefined list as "allocate a
    // fresh one", so no ordering between the two writers can ever append into
    // state shared beyond this frame.
    let childGroups: Map<StoreData, TreeTriggerGroup[] | undefined> | undefined
    const spreadGroup = (
        atoms: AtomInput[],
        groupReport: ChangeReport | undefined,
    ) => {
        let perChild: Map<StoreData, AtomInput[]> | undefined
        for (const atom of atoms) {
            const branches = data.inheritedDependencyBranches.get(atom)
            if (!branches) continue
            for (const scope of branches) {
                if (!perChild) perChild = new Map()
                const scopeAtoms = perChild.get(scope)
                if (scopeAtoms) scopeAtoms.push(atom)
                else perChild.set(scope, [atom])
            }
        }
        if (perChild) {
            if (!childGroups) childGroups = new Map()
            for (const [scope, scopeAtoms] of perChild) {
                const group: TreeTriggerGroup = {
                    kind: TREE_GROUP_INHERITED,
                    atoms: scopeAtoms,
                    set: undefined,
                    report: groupReport,
                }
                const list = childGroups.get(scope)
                if (list) list.push(group)
                else childGroups.set(scope, [group])
            }
        }
    }
    // A family OBJECT is scope-relevant only when its membership changed — a
    // value-only member update reaches scope selectors via the member atom
    // (the "family update, 100 scopes" hot path). Each group descends with its
    // own membership changes and its own report sink.
    const spreadValueGroup = (
        atoms: AtomInput[],
        collected: OwnStyleGroup,
        groupReport: ChangeReport | undefined,
    ) => {
        const changedFamilies = collector.membershipChanged[collected.index]
        if (changedFamilies) {
            const descent: AtomInput[] = atoms.slice()
            for (const family of changedFamilies) {
                if (!descent.includes(family)) descent.push(family)
            }
            spreadGroup(descent, groupReport)
        } else {
            spreadGroup(atoms, groupReport)
        }
    }
    if (peerGroup) {
        // Peer cascades historically reported into the global sink.
        spreadValueGroup(peerAtoms!, peerGroup, globalSink)
    }
    if (inheritedGroups) {
        for (const group of inheritedGroups) {
            spreadGroup(group.atoms, group.report)
        }
    }
    if (ownUpdated) {
        spreadValueGroup(ownUpdated, updatedGroup!, undefined)
    }
    if (ownDeleted) {
        // Members skip scopes that shadow them (branch index is pruned at atom
        // shadows); families always propagate — a scope selector may observe
        // only get(family), not the member.
        const deleteDescent: AtomInput[] = ownDeleted.slice()
        if (deletedFamilyAtoms) {
            for (const family of deletedFamilyAtoms.keys()) {
                if (!deleteDescent.includes(family)) deleteDescent.push(family)
            }
        }
        spreadGroup(deleteDescent, undefined)
    }
    if (ownUnset) spreadValueGroup(ownUnset, unsetGroup!, undefined)

    // ---- Phase A → B boundary: the trigger collection is now SEALED. Group
    // indices, the direct-subscriber and membership-change slots that travel
    // with them, and the static trigger union are all final; phase B may only
    // append DOWNSTREAM provenance as the dirty chain spreads. That is enforced
    // by the `TreeSettleContext` narrowing on the `treeCtx` parameter below
    // (readonly groups, readonly base union), which is what user code called
    // during the settlement sees. This engine self-check re-verifies the
    // invariants the indices rest on and is compiled out of the published
    // bundle — see assertTreeTriggersSealed and commitEngine's identical guard
    // for why the env read is written inline. ----
    if (!IS_PROD && process.env.VALDRES_ENGINE_SELF_CHECKS !== "off")
        assertTreeTriggersSealed(collector)
    const sealed: TreeSettleContext = collector

    // ---- Phase B: one settlement against the union (selector bodies, custom
    // equal, and liveness onMount/cleanup — user code, recorded + contained).
    // Changed selectors are always tracked (evaluation order) — they drive the
    // causal subscriber/report assembly below, not just onChange payloads. ----
    const changedSelectors = new Set<Selector>()
    const machineSubs = new Set<Subscription>()
    if (collector.selectors.size > 0) {
        try {
            propagateDirtySelectors(
                collector.baseUnion,
                collector.selectors,
                data,
                machineSubs,
                updatedFamilyAtoms ?? new Map(),
                false,
                notify,
                changedSelectors,
                sealed,
            )
        } catch (error) {
            recordCommitError(errors, error)
        }
    }

    // ---- Phase C: causal assembly. Deferred subscribers are inserted in
    // reaching-group order — for each group: its direct atom/family subs, then
    // the subs of selectors FIRST reached by it (evaluation order) — so a
    // selector first dirtied by an inherited trigger keeps its historical
    // position before this store's own-atom subscribers, and first-error
    // arbitration among throwing subscribers is unchanged. Reports follow the
    // same order, each group into its own sink. ----
    let hasDirectSubs = false
    for (const set of collector.directSubs) {
        if (set && set.size > 0) {
            hasDirectSubs = true
            break
        }
    }
    let orderedSubs: Set<Subscription> | undefined
    if (machineSubs.size > 0 || hasDirectSubs) {
        orderedSubs = notify.get(data)?.subscriptions ?? new Set<Subscription>()
        for (let index = 0; index < collector.groups.length; index++) {
            const direct = collector.directSubs[index]
            if (direct) addSetToSet(direct, orderedSubs)
            for (const selector of changedSelectors) {
                if (firstProvenanceOf(sealed, selector) === index) {
                    addSetToSet(data.subscriptions.get(selector), orderedSubs)
                }
            }
        }
        // Defensive remainder: anything the attribution missed (e.g. a
        // subscription added mid-evaluation) keeps its delivery, deduped by
        // the Set.
        addSetToSet(machineSubs, orderedSubs)
    }
    // Promote this store's collected subscribers + changed family members into
    // the tree accumulator (bookkeeping maps stay per-role — see
    // notifySubscribers.ts — and merge here for notification only).
    if (orderedSubs && orderedSubs.size > 0) {
        collectForNotify(
            notify,
            data,
            orderedSubs,
            peerFamilyAtoms ?? updatedFamilyAtoms ?? new Map(),
        )
        if (peerFamilyAtoms && updatedFamilyAtoms)
            collectForNotify(notify, data, orderedSubs, updatedFamilyAtoms)
        if (deletedFamilyAtoms)
            collectForNotify(notify, data, orderedSubs, deletedFamilyAtoms)
        if (unsetFamilyAtoms)
            collectForNotify(notify, data, orderedSubs, unsetFamilyAtoms)
        // A family subscription only fires for members present in the notify
        // map, so a lazily-initialized member must be promoted like any other
        // changed member — otherwise its family subscriber is collected above
        // and then silently skipped at delivery.
        if (initFamilyAtoms)
            collectForNotify(notify, data, orderedSubs, initFamilyAtoms)
        // Reverted membership: a family subscription only fires for members
        // present in the notify map, so the delta has to be promoted like any
        // other changed member.
        if (familyMemberDelta)
            collectForNotify(notify, data, orderedSubs, familyMemberDelta)
    }

    // Reports, in the same reaching-group order. Selector entries are
    // attributed to the group that FIRST reached them (the historical pass
    // that reported them); each group reports into its own sink, so folded
    // peer groups and their cascades keep the global sink's direct-set
    // metadata.
    if (changeListenerRegistry.count !== 0) {
        const selectorActive =
            changeListenerRegistry.selectorCount !== 0 &&
            hasSelectorChangeListener(data)
        const selectorsFirstReachedBy = (
            index: number,
        ): Set<Selector> | undefined => {
            if (!selectorActive) return undefined
            let result: Set<Selector> | undefined
            for (const selector of changedSelectors) {
                if (firstProvenanceOf(sealed, selector) === index) {
                    if (!result) result = new Set()
                    result.add(selector)
                }
            }
            return result
        }
        try {
            for (let index = 0; index < collector.groups.length; index++) {
                const group = collector.groups[index]!
                const groupReport = group.report ?? report
                if (groupReport === undefined) continue
                const changed = selectorsFirstReachedBy(index)
                switch (group.kind) {
                    case TREE_GROUP_INHERITED: {
                        if (changed && changed.size > 0) {
                            reportSelectorChanges(changed, data, groupReport)
                        }
                        break
                    }
                    case TREE_GROUP_GLOBAL:
                    case TREE_GROUP_UPDATED: {
                        reportAtomChanges(
                            group.atoms as Atom[],
                            data,
                            groupReport,
                            changed,
                        )
                        break
                    }
                    case TREE_GROUP_DELETED: {
                        reportDeletedAtoms(
                            group.atoms as AtomFamilyAtom<any, any>[],
                            data,
                            groupReport,
                            changed,
                        )
                        break
                    }
                    case TREE_GROUP_UNSET: {
                        for (const atom of group.atoms) {
                            reportUnsetAtom(
                                atom as Atom,
                                data,
                                effectiveValueAfterUnset(atom as Atom, data),
                                groupReport,
                            )
                        }
                        if (changed && changed.size > 0) {
                            reportSelectorChanges(changed, data, groupReport)
                        }
                        break
                    }
                }
            }
        } catch (error) {
            recordCommitError(errors, error)
        }
    }

    // ---- Recurse: plan children merged with branch-index children, each
    // visited exactly once. ----
    if (entry?.children) {
        for (const child of entry.children) {
            if (!childGroups) childGroups = new Map()
            if (!childGroups.has(child.data)) {
                childGroups.set(child.data, undefined)
            }
        }
    }
    if (childGroups) {
        for (const [childData, groupList] of childGroups) {
            let childEntry: CommitForestEntry | undefined
            if (entry?.children) {
                for (const child of entry.children) {
                    if (child.data === childData) {
                        childEntry = child
                        break
                    }
                }
            }
            settleTreeStore(
                childEntry,
                childData,
                groupList,
                foldedPeerAtoms,
                globalSink,
                notify,
                report,
                errors,
                timestamp,
            )
        }
    }
}

// Scope-recursive entry: re-evaluate selectors that depend on these atoms in
// this scope and cross into nested scopes. Skips collecting direct atom and
// family subscribers — the parent scope already collected those, and family
// index bookkeeping has already cascaded via recursivelyUpdateIndexes.
const propagateInScope = (
    atoms: AtomInput[],
    data: StoreData,
    isInitOnly = false,
    notify?: NotifyTarget,
    report?: ChangeReport,
) => {
    // Selector subscribers must accumulate into THIS store's notify entry (so
    // they fire once at the end); `families` is unused here (this entry skips
    // direct atom/family subscribers — the parent pass collected those).
    const notifyEntry = notify?.get(data)
    const subscriptions = notifyEntry
        ? notifyEntry.subscriptions
        : new Set<Subscription>()
    const families = new Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>()
    const selectors = new Set<Selector>()

    for (const atom of atoms) {
        addDependentsToSet(data.stateDependents.get(atom), selectors, data)
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

    propagateDirtySelectors(
        atoms,
        selectors,
        data,
        subscriptions,
        families,
        isInitOnly,
        notify,
        changedSelectors,
    )
    if (notify) collectForNotify(notify, data, subscriptions, families)

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
        // Fast path for single-atom updates (most common case): the index is
        // already pruned at atom shadows and contains only affected branches.
        const atom = atoms[0]
        const branches = data.inheritedDependencyBranches.get(atom)
        if (!branches) return
        for (const scope of branches) {
            propagateInScope(atoms, scope, isInitOnly, notify, report)
        }
        return
    }

    // Multi-atom path: invert the per-state branch sets into one pass per
    // affected child. Idle siblings never enter this map, and each child sees
    // only the atoms whose inherited value can affect its subtree.
    const atomsByScope = new Map<StoreData, AtomInput[]>()
    for (const atom of atoms) {
        const branches = data.inheritedDependencyBranches.get(atom)
        if (!branches) continue
        for (const scope of branches) {
            const scopeAtoms = atomsByScope.get(scope)
            if (scopeAtoms) {
                scopeAtoms.push(atom)
            } else {
                atomsByScope.set(scope, [atom])
            }
        }
    }
    for (const [scope, scopeAtoms] of atomsByScope) {
        propagateInScope(scopeAtoms, scope, isInitOnly, notify, report)
    }
}

const propagateDirtySelectors = (
    updatedAtoms: Atom[] | ReadonlySet<Atom>,
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
    // Cross-scope walk only: reaching-pass groups + per-selector provenance
    // for the public `equal` contract (see treeEqualAcrossGroups). Undefined
    // everywhere else — the single-set equality path is unchanged.
    treeCtx?: TreeSettleContext,
) => {
    const updatedInitializedAtoms = new Set<Atom>(updatedAtoms)
    if (selectors.size > 0) {
        if (!IS_PROD && data.architectureInstrumentation)
            recordStoreSettlement(data)
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
            treeCtx,
        )
    }
    // When deferring a store-tree propagation or multi-pass commit, the caller
    // owns `subscriptions` / `families` and fires them once after every pass.
    if (!notify && subscriptions.size > 0) {
        callSubscribers(subscriptions, families)
    }
}

/** Commit-engine settlement for a native async selector. Its own getter has
 * already resolved and been applied, so only downstream selectors recompute.
 * The resolving selector is then included in the same selector-change report.
 * A subscriber failure escapes before reporting, preserving the historical
 * child-Promise rejection disposition and first-error arbitration. */
export const settleAsyncSelectorCommit: SelectorSettleFn = (
    selector,
    data,
    report,
) => {
    const dependents = data.stateDependents.get(selector)
    const subs = data.subscriptions.get(selector)
    if ((!subs || subs.size === 0) && (!dependents || dependents.size === 0)) {
        return
    }

    const changedSelectors =
        report !== undefined &&
        changeListenerRegistry.selectorCount !== 0 &&
        hasSelectorChangeListener(data)
            ? new Set<Selector>()
            : undefined
    propagateDirtySelectors(
        [],
        new Set<Selector>(dependents),
        data,
        new Set<Subscription>(subs),
        new Map(),
        false,
        undefined,
        changedSelectors,
    )
    if (changedSelectors && report !== undefined) {
        changedSelectors.add(selector)
        reportSelectorChanges(changedSelectors, data, report)
    }
}

type SelectorScheduleContext = DepsChange & {
    collectedSubscribers: Set<any>
    updatedInitializedAtoms: Set<Atom>
    isInitOnly: boolean
    changedSelectors?: Set<Selector>
    treeCtx?: TreeSettleContext
    outcome: EvaluationOutcome
}

const settleScheduledSelector = (
    selector: Selector,
    data: StoreData,
    context: SelectorScheduleContext,
): number => {
    const currentValue = data.values.get(selector)
    if (isPromiseLike(currentValue) && context.isInitOnly) return 0

    const dependents = data.stateDependents.get(selector)
    const subscribers = data.subscriptions.get(selector)
    if (
        !isPromiseLike(currentValue) &&
        (!dependents || dependents.size === 0) &&
        (!subscribers || subscribers.size === 0)
    ) {
        // No live consumer — invalidate for lazy re-eval on next read.
        if (data.values.delete(selector)) {
            noteStateValueChanged(selector, data)
        }
        return 0
    }

    context.added = undefined
    context.removed = undefined
    const wasValueUpdated = reEvaluateSelector(
        selector,
        data,
        context.updatedInitializedAtoms,
        context,
        context.outcome,
        currentValue,
        context.treeCtx,
    )
    const added = context.added as Set<State> | undefined
    const removed = context.removed as Set<State> | undefined
    let result = 0
    if (added || removed) {
        applyLiveDependencyDiff(selector, added, removed, data)
        result |= SCHEDULE_GRAPH_CHANGED
    }
    if (wasValueUpdated) {
        result |= SCHEDULE_CHANGED
        if (context.changedSelectors) {
            context.changedSelectors.add(selector)
        }
        if (subscribers) {
            addSetToSet(subscribers, context.collectedSubscribers)
        }
    }
    return result
}

const propagateScheduledSelector = (
    parent: Selector,
    child: Selector,
    context: SelectorScheduleContext,
) => {
    if (context.treeCtx) {
        mergeTreeProvenance(context.treeCtx, child, parent)
    }
}

// Re-evaluate the dirty selector closure in dependency order. The graph scheduler
// owns ordinary Kahn ordering, dynamic-dependency resweeps, and the isolated
// insertion-order fallback for cyclic regions.
const propagateSelectorUpdates = (
    selectors: Set<Selector>,
    data: StoreData,
    collectedSubscribers: Set<any>,
    updatedInitializedAtoms: Set<Atom>,
    isInitOnly = false,
    changedSelectors?: Set<Selector>,
    treeCtx?: TreeSettleContext,
) => {
    if (selectors.size === 0) return

    // Own the per-pass liveness-reconcile collector. `evaluateSelector` populates
    // `data.livenessSeeds` (selectors whose dep SET changed + removed deps) and
    // arms one of two flags: `livenessRemovalArmed` (a dep was removed — gated on
    // a cycle below) or `livenessLazyArmed` (a lazy re-init committed edges
    // outside the loop — unconditional). A purely-additive loop-driven pass is
    // correct incrementally (even through cycles), so it arms neither. Allocated
    // only when a dep-set actually changes — the no-churn fast path never trips it.
    // Take ownership of the liveness collector. Selector settlement can run user
    // onMount/cleanup code that throws, so endLivenessPass runs in the `finally`
    // (else a throwing hook would strand the collector and permanently disable
    // reconcile). Reconcile the returned region AFTER the try so a throwing pass
    // never re-enters user code and masks its original error.
    const ownsLivenessSeeds = beginLivenessPass(data)
    let seedsToReconcile: Set<State> | null = null
    try {
        const context: SelectorScheduleContext = {
            added: undefined,
            removed: undefined,
            collectedSubscribers,
            updatedInitializedAtoms,
            isInitOnly,
            changedSelectors,
            treeCtx,
            outcome: createEvaluationOutcome(),
        }
        scheduleSelectors(
            selectors,
            data,
            context,
            settleScheduledSelector,
            propagateScheduledSelector,
        )
    } finally {
        // Always release the collector — even if a user onMount/cleanup above threw
        // (see the note at the top). Returns the region to reconcile, or null.
        if (ownsLivenessSeeds) seedsToReconcile = endLivenessPass(data)
    }

    // OWNER-DEFERRED reconciliation (the mode this site and the store read path
    // use; unsubscribe.ts is the IMMEDIATE one — see the two-calling-modes note
    // on reconcileLivenessAfterChurn). Only the outermost owner gets a non-null
    // region back, so a nested propagation reconciles nothing and this runs once
    // per commit. Reconcile AFTER the owned region is released (an in-flight
    // exception from the try skips this entirely, so a throwing pass never
    // re-enters user code here).
    if (seedsToReconcile) reconcileLivenessAfterChurn(seedsToReconcile, data)
}
