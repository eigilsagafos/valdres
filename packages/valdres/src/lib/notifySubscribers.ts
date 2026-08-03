import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"

// Subscriber delivery for a settlement: the deferred-notification accumulator
// (`NotifyTarget`), the per-store collection helpers that fill it, and the two
// dispatch primitives (`callSubscribers` inline, `notifyDeferred` at the end of
// a multi-store/multi-pass commit).
//
// This is the NOTIFICATION owner and nothing else — it holds no graph, value,
// or report state, and imports no propagation, evaluation, or write-path
// module (types only), so it stays a leaf outside the core write-path import
// cycle (see test/import-cycles).

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

export const notifyEntryFor = (
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

export const callSubscribers = (
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
export const collectForNotify = (
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
