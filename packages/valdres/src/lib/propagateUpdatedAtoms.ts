import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
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
import { evaluateSelector, handleSelectorResult } from "./initSelector"
import {
    applyLiveDependencyDiff,
    beginLivenessPass,
    createEvaluationOutcome,
    endLivenessPass,
    hasInheritedDependencyBranches,
    installEvaluationDeps,
    isLive,
    reconcileLivenessAfterChurn,
    scheduleSelectors,
    SCHEDULE_CHANGED,
    SCHEDULE_GRAPH_CHANGED,
    type EvaluationOutcome,
} from "./graph"
import { recordCommitError, type CommitErrors } from "./commitErrors"
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
import {
    beginCommit,
    commitEndRegistry,
    endCommit,
} from "./onCommitEnd"
import { setValueInData } from "./setValueInData"
import { noteStateValueChanged } from "./stateRevisions"
import {
    recordDependencyEdgeVisit,
    recordSelectorSettlement,
    recordStoreSettlement,
} from "./architectureInstrumentation"
import { IS_PROD } from "./IS_PROD"
import type { SettleFlags } from "../types/SettleFlags"
import type { SelectorSettleFn } from "../types/SelectorSettleFn"

export type { AtomFamilyIndex } from "./atomFamilyIndex"
export {
    cloneAtomFamilyIndex,
    createAtomFamilyIndex,
    renderAtomFamilyIndex,
} from "./atomFamilyIndex"

type AtomInput = Atom<any> | AtomFamilyAtom<any, any> | AtomFamily<any, any>

// Deferred-notification target for a multi-store propagation or multi-pass
// commit (an immediate scoped update, a cross-scope txn, or a single-store
// update+delete txn). Each store-pass collects its subscribers here instead of
// firing them; the owner fires them ONCE at the very end — after every value
// across every affected store is final. That is what makes a transaction
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
// Two models coexist behind the shared write-all-then-settle guarantee:
//   - MULTI-PASS (single-store cleanup commits, global fan-out, immediate
//     scoped updates): deliberately dumb and robust — each pass re-derives a
//     store's selectors against final state; a selector reachable by two
//     passes is simply recomputed in each (the equality check discards the
//     redundant result), and passes run root-first so the last pass to touch a
//     selector always lands on the correct value. Any future dedup here must
//     be keyed per (store, selector) and provably value-identical — never a
//     correctness shortcut that suppresses a needed recompute.
//   - VISIT-ONCE (settleCommitForest, the cross-scope/global
//     commit): each store is visited exactly once with the COMPLETE union of
//     its own and inherited triggers collected before evaluation, so the
//     topological order puts intermediate selectors before spanning ones and
//     one evaluation lands on the final value. That is a restructure, not a
//     skip guard — nothing reachable is ever skipped, so neither #168 failure
//     mode applies.
// In both models notification is deferred and fires once per subscriber.
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

// One reaching pass's triggers at one store during the cross-scope settlement
// walk. `report` is the sink the group's changes historically targeted (the
// global sink for peer-originated groups and their cascades; undefined = the
// transaction's own sink). `set` is the lazily-built equality view.
type TreeTriggerGroup = {
    kind:
        | typeof TREE_GROUP_INHERITED
        | typeof TREE_GROUP_GLOBAL
        | typeof TREE_GROUP_UPDATED
        | typeof TREE_GROUP_DELETED
        | typeof TREE_GROUP_UNSET
    atoms: AtomInput[]
    set: Set<any> | undefined
    report: ChangeReport | undefined
}
const TREE_GROUP_INHERITED = 0
const TREE_GROUP_GLOBAL = 1
const TREE_GROUP_UPDATED = 2
const TREE_GROUP_DELETED = 3
const TREE_GROUP_UNSET = 4

// Per-store settlement context for the cross-scope walk: the reaching-pass
// groups in historical order and, per selector, WHICH groups reached it (its
// trigger provenance — ascending group indices, first-reached first). Both the
// public equal contract and report/subscriber causal ordering key off it.
type TreeSettleContext = {
    groups: TreeTriggerGroup[]
    provenance: Map<Selector, number[]>
    /** The static pre-settlement trigger union; atoms the evaluation lazily
     *  initializes are exactly those in the live set but not here. */
    baseUnion: Set<any>
}

const appendTreeProvenance = (
    provenance: Map<Selector, number[]>,
    selector: Selector,
    groupIndex: number,
) => {
    const existing = provenance.get(selector)
    if (!existing) provenance.set(selector, [groupIndex])
    else if (!existing.includes(groupIndex)) {
        // Collection runs groups in ascending order and downstream merges
        // insert-sort, so `existing` stays ascending: first = first-reached.
        let at = existing.length
        while (at > 0 && existing[at - 1]! > groupIndex) at--
        existing.splice(at, 0, groupIndex)
    }
}

// Downstream provenance flow: a changed selector hands its reaching groups to
// every dependent it dirties, mirroring how each historical pass reached the
// dependent transitively.
const mergeTreeProvenance = (
    ctx: TreeSettleContext,
    target: Selector,
    source: Selector,
) => {
    const from = ctx.provenance.get(source)
    if (!from) return
    for (const groupIndex of from) {
        appendTreeProvenance(ctx.provenance, target, groupIndex)
    }
}

// Group-sequential equality for the cross-scope settlement walk. The selector
// body ran ONCE (against final state), but its public `equal` contract still
// sees the same per-reaching-pass trigger sets the historical multi-pass
// commit delivered — consulted in reaching order for exactly the groups whose
// dirty chain reached THIS selector, committing on the first group that
// reports a change. Only when every reaching group reports equality is the
// update suppressed, matching the historical chain where one pass's
// suppression left the next pass's trigger set to decide. Atoms lazily
// initialized during the settlement (present in the live evaluation set but
// not in the static union) join the final consulted set, mirroring how they
// joined the historical pass's mutating set. (Residue for impure predicates: a
// group after the first "changed" is no longer consulted.)
const treeEqualAcrossGroups = (
    ctx: TreeSettleContext,
    selector: Selector,
    existingValue: unknown,
    updatedValue: unknown,
    liveAtoms: Set<Atom>,
): boolean => {
    const provenance = ctx.provenance.get(selector)
    if (!provenance || provenance.length === 0) {
        // Defensive: a selector with no recorded provenance (unreachable in
        // practice) sees the full live set — the conservative superset.
        return selector.equal(existingValue, updatedValue, liveAtoms)
    }
    const last = provenance.length - 1
    for (let i = 0; i <= last; i++) {
        const group = ctx.groups[provenance[i]!]!
        let set = group.set
        if (set === undefined) {
            set = new Set(group.atoms)
            group.set = set
        }
        if (i === last && liveAtoms.size > ctx.baseUnion.size) {
            const augmented = new Set(set)
            for (const atom of liveAtoms) {
                if (!ctx.baseUnion.has(atom)) augmented.add(atom)
            }
            set = augmented
        }
        if (!selector.equal(existingValue, updatedValue, set)) return false
    }
    return true
}

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

        // Use reference equality for promises — deep equal treats all
        // promises as structurally identical (both have zero own keys).
        const areEqual =
            isPromiseLike(existingValue) || isPromiseLike(updatedValue)
                ? existingValue === updatedValue
                : treeCtx === undefined
                  ? selector.equal(existingValue, updatedValue, updatedAtoms)
                  : treeEqualAcrossGroups(
                        treeCtx,
                        selector,
                        existingValue,
                        updatedValue,
                        updatedAtoms,
                    )
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

// Fire the subscribers accumulated by a deferred store-tree propagation or
// multi-pass commit, once, after every pass has run and every value is final.
// Per store (root-first, by insertion order): each store's subscriptions fire
// against only that store's changed family members, so a family subscription
// never fires for a member that changed in a different store.
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
// callSubscribers can resolve that store's family-atom subscriptions once in
// the final notify phase. This is the NOTIFICATION side only. The per-pass map
// handed in here is the SAME data a pass uses to drive index bookkeeping
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

// Promote a pass's already-allocated collectors into the per-store notify map
// only when there is something to dispatch. This keeps a scoped propagation
// with no subscribers on its old allocation profile apart from the one tree
// accumulator: it does not create an entry object + Set + Map for every scope.
// A later pass for the same store reuses the promoted entry and merges only its
// family members.
const collectForNotify = (
    notify: NotifyTarget,
    data: StoreData,
    subscriptions: Set<Subscription>,
    changedByFamily: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>,
) => {
    if (subscriptions.size === 0) return
    const entry = notify.get(data)
    if (entry === undefined) {
        notify.set(data, { subscriptions, families: changedByFamily })
    } else {
        collectFamilyAtomsForNotify(entry, changedByFamily)
    }
}

const addSetToSet = (fromSet: Set<any> | undefined, toSet: Set<any>) => {
    if (fromSet && fromSet.size > 0) {
        for (const item of fromSet) {
            toSet.add(item)
        }
    }
}

const addDependentsToSet = (
    fromSet: Set<any> | undefined,
    toSet: Set<any>,
    data: StoreData,
) => {
    if (IS_PROD || !data.architectureInstrumentation) {
        addSetToSet(fromSet, toSet)
        return
    }
    if (fromSet && fromSet.size > 0) {
        for (const item of fromSet) {
            recordDependencyEdgeVisit(data)
            toSet.add(item)
        }
    }
}

const findClosestStoreWithAtomInitialized = (atom: State, data: StoreData) => {
    if (!data.parent) return data
    if (data.values.has(atom)) return data
    return findClosestStoreWithAtomInitialized(atom, data.parent)
}

const findInClosestStore = (state: State<any>, data: StoreData) => {
    const store = findClosestStoreWithAtomInitialized(state, data)
    return store.values.get(state)
}

const settleDeletedAtoms = (
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
                // @ts-ignore
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
                if (familyAtoms.size === 0)
                    throw new Error("Should not be possible")

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
        // same data. See collectFamilyAtomsForNotify for why they must not share a
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
                // Family subscriptions are member-change subscriptions: they
                // still fire for value-only writes with the changed member's
                // args. Selectors that read the family object, however, depend
                // only on membership and should run only when its list changes.
                addSetToSet(data.subscriptions.get(family), subscriptions)
                if (familyAtoms.size === 0)
                    throw new Error("Should not be possible")
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

/**
 * Settlement (phases 4–7) of any commit with cleanup mutations, global peers,
 * or nested scopes: ONE root-first walk over the affected store tree. Each
 * store is visited exactly once and settled against the union of its own
 * updated/deleted/unset writes and every inherited change that reaches it, so a
 * selector evaluates at most once per (store, commit) — the proven-safe
 * replacement for the historical one-propagation-pass-per-store model (see the
 * NotifyTarget warning above: this is a visit-once restructure behind the
 * write-all-then-settle guarantee, not a skip guard; nothing is deduplicated
 * away, work is simply not repeated).
 *
 * A non-global single-store transaction is simply the degenerate forest: one
 * entry, one root, no descent. Its update/delete/unset triggers are three
 * groups on the SAME node rather than three sequential passes over it, so the
 * mutation KIND no longer decides how many times a store settles.
 *
 * Global peers (already written in the write phase) bracket the walk with the
 * exact sequencing the transaction commit previously hand-rolled inline: peer
 * propagation first (their fan-out retains its public direct-set metadata and
 * precedes the originating transaction's reports), one deferred notify for
 * peers + tree together, global sink flush, then the peer trees' commit-end
 * boundaries. Unset re-delegation runs strictly last — the deferred
 * scope-local callback idempotently drops its delegate, so the fresh parent
 * delegate must be (re)established after firing.
 *
 * Error contract: each store's settlement and reporting record into `errors`
 * and the walk continues — one store failing must not starve later stores,
 * descendants, or subscriber delivery. Descent is constructed in the
 * collection phase (no user code) so a throwing selector body, custom equal,
 * onMount cleanup, or unset report can never hide an affected descendant.
 *
 * Boundary note: the caller's outer commit boundary governs; the walk opens no
 * per-store boundaries (the historical inner per-pass boundaries were nested
 * depth-counter no-ops). An onCommitEnd listener registered mid-commit by a
 * hook therefore joins from the next commit, as on the single-store plan path.
 */
type ForestNode = CommitForestEntry

/** Canonicalize local plan entries and global peer updates into one sparse
 * forest node per physical StoreData. Ancestor placeholders carry no mutation
 * groups; they exist only to make overlapping peer/origin paths one structural
 * walk rather than a selector-level skip guard. */
const buildCommitForest = (
    entries: CommitForestEntry[],
    globalUpdates: Map<StoreData, Atom<any>[]> | undefined,
): {
    roots: ForestNode[]
    peerAtoms: Map<StoreData, Atom<any>[]> | undefined
} => {
    const nodes = new Map<StoreData, ForestNode>()
    const ensureNode = (data: StoreData): ForestNode => {
        const existing = nodes.get(data)
        if (existing) return existing
        const node: ForestNode = {
            data,
            updatedAtoms: [],
            deleted: undefined,
            unsetAtoms: undefined,
            children: undefined,
        }
        nodes.set(data, node)
        if (data.parent) {
            const parent = ensureNode(data.parent)
            if (parent.children) parent.children.push(node)
            else parent.children = [node]
        }
        return node
    }

    for (const entry of entries) {
        const node = ensureNode(entry.data)
        if (entry.updatedAtoms.length > 0)
            node.updatedAtoms.push(...entry.updatedAtoms)
        if (entry.deleted) {
            if (node.deleted) node.deleted.push(...entry.deleted)
            else node.deleted = entry.deleted
        }
        if (entry.unsetAtoms) {
            if (node.unsetAtoms) node.unsetAtoms.push(...entry.unsetAtoms)
            else node.unsetAtoms = entry.unsetAtoms
        }
    }
    if (globalUpdates) {
        for (const peer of globalUpdates.keys()) ensureNode(peer)
    }

    const roots: ForestNode[] = []
    const added = new Set<StoreData>()
    // One tree ⇔ one root, so tree identity is the dedupe key and `tree.root`
    // resolves the owner without walking `parent`.
    const addRoot = (data: StoreData) => {
        const root = data.tree.root
        if (!added.has(root)) {
            added.add(root)
            roots.push(ensureNode(root))
        }
    }
    const originTree = entries.length > 0 ? entries[0].data.tree : undefined
    if (globalUpdates) {
        for (const peer of globalUpdates.keys()) {
            if (peer.tree !== originTree) addRoot(peer)
        }
    }
    for (const entry of entries) {
        if (entry.data.tree !== originTree) addRoot(entry.data)
    }
    if (originTree) addRoot(originTree.root)
    if (!originTree && globalUpdates) {
        for (const peer of globalUpdates.keys()) addRoot(peer)
    }
    return { roots, peerAtoms: globalUpdates }
}

/** Close every commit boundary a forest settlement opened. Each one gets its
 *  own try/catch so a throwing listener cannot strand the trees queued behind
 *  it — the failure mode this exists to prevent is a depth counter stuck above
 *  zero, which silences that tree's onCommitEnd for the rest of the process. */
const closeCommitBoundaries = (
    commitTrees: StoreTreeRuntime[],
    errors: CommitErrors,
    swallowErrors: boolean,
) => {
    for (const tree of commitTrees) {
        try {
            endCommit(tree, swallowErrors)
        } catch (error) {
            recordCommitError(errors, error)
        }
    }
}

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
    const groups: TreeTriggerGroup[] = []
    const provenance = new Map<Selector, number[]>()
    const selectors = new Set<Selector>()
    const triggerUnion = new Set<any>()
    // Direct atom/family subscribers per group index (own-write and folded
    // global groups only — inherited triggers reach only dependents; their
    // direct subscriptions are delegated to the owning ancestor store).
    const directSubs: (Set<Subscription> | undefined)[] = []

    const peerAtoms = foldedPeerAtoms?.get(data)

    const pushGroup = (group: TreeTriggerGroup): number => {
        const index = groups.length
        groups.push(group)
        directSubs.push(undefined)
        membershipChangedByGroup.push(undefined)
        return index
    }

    const collectInheritedGroup = (group: TreeTriggerGroup) => {
        const index = pushGroup(group)
        for (const atom of group.atoms) {
            const dependents = data.stateDependents.get(atom)
            if (dependents && dependents.size > 0) {
                for (const dependent of dependents) {
                    if (!IS_PROD && data.architectureInstrumentation)
                        recordDependencyEdgeVisit(data)
                    selectors.add(dependent as Selector)
                    appendTreeProvenance(
                        provenance,
                        dependent as Selector,
                        index,
                    )
                }
            }
            triggerUnion.add(atom)
        }
    }

    let updatedFamilyAtoms:
        | Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>
        | undefined
    let deletedFamilyAtoms:
        | Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>
        | undefined
    let unsetFamilyAtoms:
        | Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>
        | undefined
    let peerFamilyAtoms:
        | Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>
        | undefined
    // Families whose MEMBERSHIP changed, per group — each group's descent
    // carries its own membership changes (and its own report sink).
    const membershipChangedByGroup: (Set<AtomFamily<any>> | undefined)[] = []

    // Own-write and folded-peer groups collect identically (deps + direct subs
    // + family grouping) — exactly what the historical per-pass
    // settleCommit did; only reporting differs (phase C).
    const collectOwnStyleGroup = (
        group: TreeTriggerGroup,
    ): {
        index: number
        familyAtoms: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>> | undefined
    } => {
        const index = pushGroup(group)
        const subs = new Set<Subscription>()
        directSubs[index] = subs
        let familyAtoms:
            | Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>
            | undefined
        for (const atom of group.atoms) {
            const dependents = data.stateDependents.get(atom)
            if (dependents && dependents.size > 0) {
                for (const dependent of dependents) {
                    if (!IS_PROD && data.architectureInstrumentation)
                        recordDependencyEdgeVisit(data)
                    selectors.add(dependent as Selector)
                    appendTreeProvenance(
                        provenance,
                        dependent as Selector,
                        index,
                    )
                }
            }
            addSetToSet(data.subscriptions.get(atom), subs)
            triggerUnion.add(atom)
            if (isFamilyAtom(atom)) {
                if (!familyAtoms) familyAtoms = new Map()
                let set = familyAtoms.get(atom.family)
                if (!set) {
                    set = new Set()
                    familyAtoms.set(atom.family, set)
                }
                set.add(atom)
            }
        }
        return { index, familyAtoms }
    }
    // Family ADD bookkeeping (mirrors settleCommit): family
    // subscriptions are member-change subscriptions and always collect; family
    // DEPENDENTS run only when membership actually changed.
    const applyFamilyAdds = (
        familyAtoms: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>,
        groupIndex: number,
    ) => {
        const subs = directSubs[groupIndex]!
        for (const [family, atoms] of familyAtoms) {
            addSetToSet(data.subscriptions.get(family), subs)
            if (addFamilyAtomsToSet(family, atoms, data, timestamp)) {
                const dependents = data.stateDependents.get(family)
                if (dependents && dependents.size > 0) {
                    for (const dependent of dependents) {
                        if (!IS_PROD && data.architectureInstrumentation)
                            recordDependencyEdgeVisit(data)
                        selectors.add(dependent as Selector)
                        appendTreeProvenance(
                            provenance,
                            dependent as Selector,
                            groupIndex,
                        )
                    }
                }
                let changed = membershipChangedByGroup[groupIndex]
                if (!changed) {
                    changed = new Set()
                    membershipChangedByGroup[groupIndex] = changed
                }
                changed.add(family)
            }
        }
    }

    // The folded global-peer group comes FIRST: the historical global loop
    // propagated every peer before any per-store transaction pass.
    let peerGroupIndex = -1
    if (peerAtoms) {
        const collected = collectOwnStyleGroup({
            kind: TREE_GROUP_GLOBAL,
            atoms: peerAtoms,
            set: undefined,
            report: globalSink,
        })
        peerGroupIndex = collected.index
        peerFamilyAtoms = collected.familyAtoms
        if (peerFamilyAtoms) applyFamilyAdds(peerFamilyAtoms, peerGroupIndex)
    }

    if (inheritedGroups) {
        for (const group of inheritedGroups) collectInheritedGroup(group)
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

    let updatedGroupIndex = -1
    if (ownUpdated) {
        const collected = collectOwnStyleGroup({
            kind: TREE_GROUP_UPDATED,
            atoms: ownUpdated,
            set: undefined,
            report: undefined,
        })
        updatedGroupIndex = collected.index
        updatedFamilyAtoms = collected.familyAtoms
        if (updatedFamilyAtoms)
            applyFamilyAdds(updatedFamilyAtoms, updatedGroupIndex)
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

    let deletedGroupIndex = -1
    if (ownDeleted) {
        // Mirrors deleted-atom settlement: member deps + subs, then per-family
        // deps + subs + index removal. A deleted member changes both its own
        // value and family membership.
        deletedGroupIndex = pushGroup({
            kind: TREE_GROUP_DELETED,
            atoms: ownDeleted,
            set: undefined,
            report: undefined,
        })
        const subs = new Set<Subscription>()
        directSubs[deletedGroupIndex] = subs
        for (const atom of ownDeleted) {
            const dependents = data.stateDependents.get(atom)
            if (dependents && dependents.size > 0) {
                for (const dependent of dependents) {
                    if (!IS_PROD && data.architectureInstrumentation)
                        recordDependencyEdgeVisit(data)
                    selectors.add(dependent as Selector)
                    appendTreeProvenance(
                        provenance,
                        dependent as Selector,
                        deletedGroupIndex,
                    )
                }
            }
            addSetToSet(data.subscriptions.get(atom), subs)
            triggerUnion.add(atom)
            if (isFamilyAtom(atom)) {
                if (!deletedFamilyAtoms) deletedFamilyAtoms = new Map()
                let set = deletedFamilyAtoms.get(atom.family)
                if (!set) {
                    set = new Set()
                    deletedFamilyAtoms.set(atom.family, set)
                }
                set.add(atom)
            }
        }
        if (deletedFamilyAtoms) {
            for (const [family, familyAtoms] of deletedFamilyAtoms) {
                const dependents = data.stateDependents.get(family)
                if (dependents && dependents.size > 0) {
                    for (const dependent of dependents) {
                        if (!IS_PROD && data.architectureInstrumentation)
                            recordDependencyEdgeVisit(data)
                        selectors.add(dependent as Selector)
                        appendTreeProvenance(
                            provenance,
                            dependent as Selector,
                            deletedGroupIndex,
                        )
                    }
                }
                addSetToSet(data.subscriptions.get(family), subs)
                deleteFamilyAtomsFromSet(family, familyAtoms, data, timestamp)
            }
        }
    }

    let unsetGroupIndex = -1
    if (ownUnset) {
        const collected = collectOwnStyleGroup({
            kind: TREE_GROUP_UNSET,
            atoms: ownUnset,
            set: undefined,
            report: undefined,
        })
        unsetGroupIndex = collected.index
        unsetFamilyAtoms = collected.familyAtoms
        if (unsetFamilyAtoms) applyFamilyAdds(unsetFamilyAtoms, unsetGroupIndex)
    }

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
        groupIndex: number,
        groupReport: ChangeReport | undefined,
    ) => {
        const changedFamilies = membershipChangedByGroup[groupIndex]
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
    if (peerGroupIndex !== -1) {
        // Peer cascades historically reported into the global sink.
        spreadValueGroup(peerAtoms!, peerGroupIndex, globalSink)
    }
    if (inheritedGroups) {
        for (const group of inheritedGroups) {
            spreadGroup(group.atoms, group.report)
        }
    }
    if (ownUpdated) {
        spreadValueGroup(ownUpdated, updatedGroupIndex, undefined)
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
    if (ownUnset) spreadValueGroup(ownUnset, unsetGroupIndex, undefined)

    // ---- Phase B: one settlement against the union (selector bodies, custom
    // equal, and liveness onMount/cleanup — user code, recorded + contained).
    // Changed selectors are always tracked (evaluation order) — they drive the
    // causal subscriber/report assembly below, not just onChange payloads. ----
    const changedSelectors = new Set<Selector>()
    const machineSubs = new Set<Subscription>()
    if (selectors.size > 0) {
        const treeCtx: TreeSettleContext = {
            groups,
            provenance,
            baseUnion: triggerUnion,
        }
        try {
            propagateDirtySelectors(
                triggerUnion,
                selectors,
                data,
                machineSubs,
                updatedFamilyAtoms ?? new Map(),
                false,
                notify,
                changedSelectors,
                treeCtx,
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
    const firstProvenanceOf = (selector: Selector): number => {
        const chain = provenance.get(selector)
        return chain && chain.length > 0 ? chain[0]! : -1
    }
    let hasDirectSubs = false
    for (const set of directSubs) {
        if (set && set.size > 0) {
            hasDirectSubs = true
            break
        }
    }
    let orderedSubs: Set<Subscription> | undefined
    if (machineSubs.size > 0 || hasDirectSubs) {
        orderedSubs = notify.get(data)?.subscriptions ?? new Set<Subscription>()
        for (let index = 0; index < groups.length; index++) {
            const direct = directSubs[index]
            if (direct) addSetToSet(direct, orderedSubs)
            for (const selector of changedSelectors) {
                if (firstProvenanceOf(selector) === index) {
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
    // collectFamilyAtomsForNotify — and merge here for notification only).
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
                if (firstProvenanceOf(selector) === index) {
                    if (!result) result = new Set()
                    result.add(selector)
                }
            }
            return result
        }
        try {
            for (let index = 0; index < groups.length; index++) {
                const group = groups[index]!
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

export const propagateDirtySelectors = (
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

    // Reconcile AFTER the owned region is released (an in-flight exception from the
    // try skips this entirely, so a throwing pass never re-enters user code here).
    if (seedsToReconcile) reconcileLivenessAfterChurn(seedsToReconcile, data)
}
