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
    isLive,
    mountTransitiveDeps,
    onLiveDependencyAdded,
    onLiveDependencyRemoved,
    unmountOrphanedDeps,
} from "./mountAtom"
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
// single-store update+delete txn). Each store-pass collects subscribers here
// (deduped by the Set) instead of firing them; the commit fires them ONCE at
// the very end — after every value across every store is final. That is what
// makes a transaction *serializable to observe*: no subscriber, and nothing a
// subscriber reads, ever sees a half-applied intermediate. Left undefined on
// the single-store / non-scoped hot path, where firing stays inline.
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
export type NotifyTarget = {
    subscriptions: Set<Subscription>
    families: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>
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
    subscriptions: Set<Subscription>,
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
// after every pass has run and every value is final.
export const notifyDeferred = (notify: NotifyTarget) => {
    if (notify.subscriptions.size > 0) {
        callSubscribers(notify.subscriptions, notify.families)
    }
}

// Record a pass's changed family members into the deferred notify target, so
// callSubscribers can resolve family-atom subscriptions once at commit end.
// This is the NOTIFICATION side only. The per-pass map handed in here is the
// SAME data a pass uses to drive index bookkeeping (add/deleteFamilyAtomsFromSet)
// — but those two roles must NOT share one mutable map across passes: the
// bookkeeping map has to contain only THIS pass's atoms (a delete pass that saw
// an earlier pass's added atoms would delete them). So each pass keeps its
// bookkeeping map local and merges it here for notification.
const collectFamilyAtomsForNotify = (
    notify: NotifyTarget,
    changedByFamily: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>,
) => {
    for (const [family, atoms] of changedByFamily) {
        let target = notify.families.get(family)
        if (target === undefined) {
            target = new Set()
            notify.families.set(family, target)
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
) => {
    // When deferring, subscribers accumulate into the commit-level notify
    // target so this pass fires once, together with the others.
    if (notify) {
        subscriptions = notify.subscriptions
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
    propagateDirtySelectors(atoms, selectors, data, subscriptions, deletedFamilyAtoms, false, notify)
    if (notify) collectFamilyAtomsForNotify(notify, deletedFamilyAtoms)
    // Propagate family changes into child scopes. deleteFamilyAtomsFromSet
    // already updated each scope's family index via recursivelyUpdateIndexes;
    // selectors in those scopes that depend on the family still need to be
    // re-evaluated so their subscribers get notified.
    if (deletedFamilyAtoms.size > 0 && data.scopes && data.scopes.size > 0) {
        const scopeFamilies = new Map<StoreData, AtomFamily<any>[]>()
        for (const family of deletedFamilyAtoms.keys()) {
            const scopesWithFamily = data.scopeValueIndex.get(family)
            if (scopesWithFamily) {
                for (const scope of scopesWithFamily) {
                    let list = scopeFamilies.get(scope)
                    if (!list) {
                        list = []
                        scopeFamilies.set(scope, list)
                    }
                    list.push(family)
                }
            }
        }
        for (const [scope, familiesInScope] of scopeFamilies) {
            propagateInScope(familiesInScope, scope, false, notify)
        }
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
) => {
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
                    if (notify) addSetToSet(subs, notify.subscriptions)
                    else callSubscribers(subs)
                }
                return
            }
        }
    }

    const subscriptions = notify ? notify.subscriptions : new Set<Subscription>()
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
        if (isFamilyAtom(atom)) {
            if (!updatedFamilyAtoms.has(atom.family)) {
                updatedFamilyAtoms.set(atom.family, new Set())
            }
            // @ts-ignore
            updatedFamilyAtoms.get(atom.family).add(atom)
        }
    }

    if (updatedFamilyAtoms.size > 0) {
        const timestamp = performance.now()
        for (const [family, familyAtoms] of updatedFamilyAtoms) {
            addSetToSet(data.stateDependents.get(family), selectors)
            addSetToSet(data.subscriptions.get(family), subscriptions)
            if (familyAtoms.size === 0)
                throw new Error("Should not be possible")
            addFamilyAtomsToSet(family, familyAtoms, data, timestamp)
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

    propagateDirtySelectors(atoms, selectors, data, subscriptions, updatedFamilyAtoms, isInitOnly, notify)
    if (notify) collectFamilyAtomsForNotify(notify, updatedFamilyAtoms)

    if (data.scopes && data.scopes.size > 0) {
        propagateToScopes(atoms, data, isInitOnly, notify)
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
) => {
    // Selector subscribers must accumulate into the commit-level set (so they
    // fire once at the end); `families` is unused here (this entry skips direct
    // atom/family subscribers — the parent pass collected those).
    const subscriptions = notify ? notify.subscriptions : new Set<Subscription>()
    const families = new Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>>()
    const selectors = new Set<Selector>()

    for (const atom of atoms) {
        addSetToSet(data.stateDependents.get(atom), selectors)
    }

    propagateDirtySelectors(atoms, selectors, data, subscriptions, families, isInitOnly, notify)

    if (data.scopes && data.scopes.size > 0) {
        propagateToScopes(atoms, data, isInitOnly, notify)
    }
}

const propagateToScopes = (
    atoms: AtomInput[],
    data: StoreData,
    isInitOnly: boolean,
    notify?: NotifyTarget,
) => {
    if (atoms.length === 1) {
        // Fast path for single-atom updates (most common case)
        const atom = atoms[0]
        const shadowingScopes = isAtomFamily(atom)
            ? undefined
            : data.scopeValueIndex.get(atom)
        for (const [, scope] of data.scopes) {
            if (!shadowingScopes || !shadowingScopes.has(scope)) {
                propagateInScope(atoms, scope, isInitOnly, notify)
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
            propagateInScope(atoms, scope, isInitOnly, notify)
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
            propagateInScope(atomsToUpdateInScope, scope, isInitOnly, notify)
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

    // Set when the dependency graph changes during the walk (a selector's deps
    // were added/removed, or an out-of-closure dependent was pulled in). Only
    // then can a node be left stranded with an undrained `pending`, so the
    // settle scan below is skipped entirely on the steady-state path.
    let graphMutated = false

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
            const c = (pending.get(d) ?? 0) - 1
            pending.set(d, c)
            if (propagateChange) needsEval.add(d)
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

        const currentValue = data.values.get(selector)

        if (isPromiseLike(currentValue) && isInitOnly) {
            advance(selector, false)
            continue
        }

        if (!needsEval.has(selector)) {
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

        advance(selector, wasValueUpdated)
        if (wasValueUpdated && subscribers) {
            addSetToSet(subscribers, collectedSubscribers)
        }
    }

    // Settle stranded nodes. The `pending` counts are a snapshot taken before
    // the walk; they assume the dependency graph is fixed for its duration. But
    // a selector can be re-evaluated out-of-band DURING the walk — most commonly
    // lazily re-initialized via getState when another selector reads it (after
    // its value was dropped by an earlier orphan-invalidation/unsubscribe). If
    // that re-eval drops a dependency it was snapshotted with, the dropped
    // parent's reverse edge is gone, so it never decrements this node's
    // `pending`, which then stalls above 0 and the node is never processed —
    // even though one of its surviving dependencies changed. Such a node is left
    // stale, and so is anything that read it. Re-settle the stranded set (and
    // whatever depends on it) with a fixpoint that re-fetches dependents each
    // pass, which is inherently robust to a graph that changed under us. Guarded
    // by `graphMutated`, so the steady-state fast path skips it entirely.
    if (!graphMutated) return

    let stranded: Set<Selector> | undefined
    for (const s of closure) {
        if (needsEval.has(s) && (pending.get(s) ?? 0) > 0) {
            if (!stranded) stranded = new Set()
            stranded.add(s)
        }
    }
    if (!stranded) return

    let work = stranded
    while (work.size > 0) {
        const next = new Set<Selector>()
        for (const selector of work) {
            const currentValue = data.values.get(selector)
            if (isPromiseLike(currentValue) && isInitOnly) continue
            const dependents = data.stateDependents.get(selector)
            const subscribers = data.subscriptions.get(selector)
            if (
                !isPromiseLike(currentValue) &&
                (!dependents || dependents.size === 0) &&
                (!subscribers || subscribers.size === 0)
            ) {
                data.values.delete(selector)
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
                if (subscribers) addSetToSet(subscribers, collectedSubscribers)
                // Re-fetch dependents — eval may have changed them.
                const downstream = data.stateDependents.get(selector)
                if (downstream) {
                    for (const d of downstream) next.add(d)
                }
            }
        }
        work = next
    }
}

// Re-evaluate the initial dirty selectors, then topologically evaluate
// anything downstream of selectors whose values actually shifted. The topo
// path guarantees each transitive selector evaluates at most once per
// propagation even when reachable through paths of differing lengths — the
// wide-DAG case where a pure BFS would recompute shared nodes once per
// depth.
//
// The first sweep stays a plain linear loop (matching the legacy BFS first
// iteration) so flat fan-out and init-only chain initialization — where
// values often don't change at all — pay zero topo overhead. We only
// allocate closure/pending state when at least one parent's value shift
// produced live downstream work.
//
// Caveat: a selector that's both in the initial set AND a downstream of
// another initial selector can be evaluated twice in this scheme (once in
// the linear sweep with potentially stale upstream, once in the topo
// settle). This matches the legacy BFS behavior and is a niche case in
// practice; the wide-DAG payoff comes from intermediate (non-initial)
// selectors which the topo path handles exactly once.
const propagateSelectorUpdates = (
    selectors: Set<Selector>,
    data: StoreData,
    collectedSubscribers: Set<any>,
    updatedInitializedAtoms: Set<Atom>,
    isInitOnly = false,
) => {
    if (selectors.size === 0) return

    let downstreamSeeds: Set<Selector> | undefined

    // Reused across every re-evaluated selector — see propagateDownstreamTopo.
    const depsChange: DepsChange = {}
    for (const selector of selectors) {
        const currentValue = data.values.get(selector)
        if (isPromiseLike(currentValue) && isInitOnly) continue
        const dependents = data.stateDependents.get(selector)
        const subscribers = data.subscriptions.get(selector)
        if (
            !isPromiseLike(currentValue) &&
            (!dependents || dependents.size === 0) &&
            (!subscribers || subscribers.size === 0)
        ) {
            // No live consumer — invalidate for lazy re-eval on next read.
            data.values.delete(selector)
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
        if (!wasValueUpdated) continue
        if (subscribers) addSetToSet(subscribers, collectedSubscribers)
        // Re-fetch dependents — eval may have changed them.
        const downstream = data.stateDependents.get(selector)
        if (downstream && downstream.size > 0) {
            if (!downstreamSeeds) downstreamSeeds = new Set()
            for (const d of downstream) downstreamSeeds.add(d)
        }
    }

    if (downstreamSeeds && downstreamSeeds.size > 0) {
        propagateDownstreamTopo(
            downstreamSeeds,
            data,
            collectedSubscribers,
            updatedInitializedAtoms,
            isInitOnly,
        )
    }
}
