import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import type { AtomFamilyAtom } from "../types/AtomFamilyAtom"
import type { AtomInput } from "../types/AtomInput"
import type { Selector } from "../types/Selector"
import type { StoreData } from "../types/StoreData"
import type { Subscription } from "../types/Subscription"
import type { ChangeReport } from "./notifyChangeListeners"
import {
    addFamilyAtomsToSet,
    deleteFamilyAtomsFromSet,
} from "./atomFamilyIndex"
import { recordDependencyEdgeVisit } from "./architectureInstrumentation"
import { addSetToSet } from "./collectDependents"
import { IS_PROD } from "./IS_PROD"
import { isFamilyAtom } from "../utils/isFamilyAtom"

// Trigger provenance for the cross-scope settlement walk (`settleTreeStore` in
// propagateUpdatedAtoms.ts): the reaching-pass group model, the phase-A
// collector that builds it, and the group-sequential `equal` contract that
// consumes it.
//
// PHASE CONTRACT. A store visit collects (phase A), settles (phase B), then
// assembles subscribers and reports (phase C). Everything a later phase reads
// is written in phase A, and the collector is the single owner of that state:
//
//   - `groups`, `directSubs` and `membershipChanged` are PARALLEL arrays
//     indexed by group. `pushTreeGroup` is their only writer and extends all
//     three together, so no collection order can desynchronize them. Every
//     recorded provenance entry is an index into `groups`.
//   - `baseUnion` is the STATIC pre-settlement trigger union. Phase B compares
//     the live evaluation set against its SIZE to find atoms the evaluation
//     lazily initialized, so a trigger added after phase A would silently
//     suppress that augmentation.
//
// Both are enforced past phase A by type, not by statement order: phase B
// receives the collector as a `TreeSettleContext`, whose `groups` is a readonly
// array and whose `baseUnion` is a `ReadonlySet` — so the evaluator (and any
// user `equal` it calls) cannot append a group or grow the union. The engine
// self-check `assertTreeTriggersSealed` re-checks the array lockstep and the
// provenance index/order invariants on the collector at the A→B boundary; like
// `assertPlanLegal` it is compiled out of the published bundle.
//
// Leaf module: family-index bookkeeping, instrumentation and set primitives
// only — no evaluator, no notification, no write path — so it stays outside the
// core import cycle (see test/import-cycles). Comments here are `//` rather
// than `/** */` on purpose: this module's declarations are emitted into the
// published `dist/types`, and only block comments travel with them.

export const TREE_GROUP_INHERITED = 0
export const TREE_GROUP_GLOBAL = 1
export const TREE_GROUP_UPDATED = 2
export const TREE_GROUP_DELETED = 3
export const TREE_GROUP_UNSET = 4

// One reaching pass's triggers at one store during the cross-scope settlement
// walk. `report` is the sink the group's changes historically targeted (the
// global sink for peer-originated groups and their cascades; undefined = the
// transaction's own sink). `set` is the lazily-built equality view.
export type TreeTriggerGroup = {
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

// The SEALED view handed to phase B: the reaching-pass groups in historical
// order and, per selector, WHICH groups reached it (its trigger provenance —
// ascending group indices, first-reached first). Both the public `equal`
// contract and report/subscriber causal ordering key off it.
//
// `groups` and `baseUnion` are readonly here because phase B runs user code
// (selector bodies, custom `equal`, onMount/cleanup): it may only APPEND
// downstream provenance, never extend the collection itself. `baseUnion` is the
// static pre-settlement trigger union — atoms the evaluation lazily initializes
// are exactly those in the live set but not here.
export type TreeSettleContext = {
    readonly groups: readonly TreeTriggerGroup[]
    readonly provenance: Map<Selector, number[]>
    readonly baseUnion: ReadonlySet<any>
}

// Phase-A view of the same object: the group list plus the two arrays that
// travel with it, all writable. Widens to `TreeSettleContext` at the seal.
//   - `directSubs`: direct atom/family subscribers per group index (own-write
//     and folded global groups only — inherited triggers reach only dependents;
//     their direct subscriptions are delegated to the owning ancestor store).
//   - `membershipChanged`: families whose MEMBERSHIP changed, per group — each
//     group's descent carries its own membership changes (and report sink).
//   - `selectors`: every first-level dirty selector reached by any group.
export type TreeTriggerCollector = {
    groups: TreeTriggerGroup[]
    provenance: Map<Selector, number[]>
    baseUnion: Set<any>
    directSubs: (Set<Subscription> | undefined)[]
    membershipChanged: (Set<AtomFamily<any>> | undefined)[]
    selectors: Set<Selector>
}

export const createTreeTriggerCollector = (): TreeTriggerCollector => ({
    groups: [],
    provenance: new Map(),
    baseUnion: new Set(),
    directSubs: [],
    membershipChanged: [],
    selectors: new Set(),
})

// Sole writer of the three parallel arrays.
export const pushTreeGroup = (
    collector: TreeTriggerCollector,
    group: TreeTriggerGroup,
): number => {
    const index = collector.groups.length
    collector.groups.push(group)
    collector.directSubs.push(undefined)
    collector.membershipChanged.push(undefined)
    return index
}

export const appendTreeProvenance = (
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
export const mergeTreeProvenance = (
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

// The group that FIRST reached `selector`, or -1. Phase C's causal key.
export const firstProvenanceOf = (
    ctx: TreeSettleContext,
    selector: Selector,
): number => {
    const chain = ctx.provenance.get(selector)
    return chain && chain.length > 0 ? chain[0]! : -1
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
export const treeEqualAcrossGroups = (
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

// An inherited trigger reaches only dependents: its direct subscriptions are
// delegated to the owning ancestor store, so no `directSubs` entry is filled
// and no family bookkeeping runs.
export const collectInheritedGroup = (
    collector: TreeTriggerCollector,
    data: StoreData,
    group: TreeTriggerGroup,
) => {
    const index = pushTreeGroup(collector, group)
    // Hoisted: the per-dependent loop below is the walk's inner loop, and a
    // property load per edge is exactly the cost the pre-extraction locals did
    // not pay.
    const { selectors, provenance, baseUnion } = collector
    for (const atom of group.atoms) {
        const dependents = data.stateDependents.get(atom)
        if (dependents && dependents.size > 0) {
            for (const dependent of dependents) {
                if (!IS_PROD && data.architectureInstrumentation)
                    recordDependencyEdgeVisit(data)
                selectors.add(dependent as Selector)
                appendTreeProvenance(provenance, dependent as Selector, index)
            }
        }
        baseUnion.add(atom)
    }
}

// What collecting an own-style group yields, and the ONLY thing the follow-up
// steps that need a `directSubs` slot accept. An inherited group has no slot
// (its direct subscriptions are delegated to the owning ancestor store) and
// `collectInheritedGroup` returns nothing, so "collect the group before
// applying its family adds or descending it" is a type error rather than a
// silent write into an undefined slot.
export type OwnStyleGroup = {
    index: number
    familyAtoms: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>> | undefined
}

// Own-write and folded-peer groups collect identically (deps + direct subs +
// family grouping) — exactly what the historical per-pass `settleCommit` did;
// only reporting differs (phase C).
export const collectOwnStyleGroup = (
    collector: TreeTriggerCollector,
    data: StoreData,
    group: TreeTriggerGroup,
): OwnStyleGroup => {
    const index = pushTreeGroup(collector, group)
    const subs = new Set<Subscription>()
    collector.directSubs[index] = subs
    // Hoisted for the per-dependent loop — see collectInheritedGroup.
    const { selectors, provenance, baseUnion } = collector
    let familyAtoms: Map<AtomFamily<any>, Set<AtomFamilyAtom<any>>> | undefined
    for (const atom of group.atoms) {
        const dependents = data.stateDependents.get(atom)
        if (dependents && dependents.size > 0) {
            for (const dependent of dependents) {
                if (!IS_PROD && data.architectureInstrumentation)
                    recordDependencyEdgeVisit(data)
                selectors.add(dependent as Selector)
                appendTreeProvenance(provenance, dependent as Selector, index)
            }
        }
        addSetToSet(data.subscriptions.get(atom), subs)
        baseUnion.add(atom)
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

// Family ADD bookkeeping (mirrors `settleCommit`): family subscriptions are
// member-change subscriptions and always collect; family DEPENDENTS run only
// when membership actually changed. Reads the group's `directSubs` slot, which
// is why it takes the `OwnStyleGroup` rather than a bare index.
/** `all` minus `drops`, reusing `all` when nothing is dropped — the common case
 *  even during an `unsetAll`, since only the reverting store's own members are
 *  ever listed. */
const withoutDrops = (
    all: Set<AtomFamilyAtom<any>>,
    drops: Set<AtomFamilyAtom<any>>,
): Set<AtomFamilyAtom<any>> => {
    let kept: Set<AtomFamilyAtom<any>> | undefined
    for (const atom of all) {
        if (drops.has(atom)) {
            if (!kept) {
                kept = new Set()
                for (const earlier of all) {
                    if (earlier === atom) break
                    kept.add(earlier)
                }
            }
            continue
        }
        kept?.add(atom)
    }
    return kept ?? all
}

export const applyFamilyAdds = (
    collector: TreeTriggerCollector,
    data: StoreData,
    collected: OwnStyleGroup,
    timestamp: number,
    /** Members whose membership this group must not (re-)register — the family
     *  half of `unsetAll`, which is reverting this store's index to its
     *  parent's. Excluded before the add so a member the revert dropped is not
     *  written straight back in by its own unset settlement.
     *
     *  Only the INDEX bookkeeping is skipped. The member's value genuinely
     *  changed (it reverted to the parent's), so both its own subscribers —
     *  collected with the group — and the family's subscribers still fire. */
    membershipDrops?: Set<AtomFamilyAtom<any>>,
) => {
    const familyAtoms = collected.familyAtoms
    if (!familyAtoms) return
    const groupIndex = collected.index
    const subs = collector.directSubs[groupIndex]!
    const { selectors, provenance } = collector
    for (const [family, all] of familyAtoms) {
        // Collected for EVERY family in the group, before `membershipDrops`
        // narrows what the index records: a family subscription is a
        // member-change subscription and fires for a value-only write too.
        addSetToSet(data.subscriptions.get(family), subs)
        const atoms = membershipDrops ? withoutDrops(all, membershipDrops) : all
        if (atoms.size === 0) continue
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
            let changed = collector.membershipChanged[groupIndex]
            if (!changed) {
                changed = new Set()
                collector.membershipChanged[groupIndex] = changed
            }
            changed.add(family)
        }
    }
}

// Mirrors deleted-atom settlement: member deps + subs, then per-family deps +
// subs + index removal. A deleted member changes both its own value and family
// membership, so the family's dependents are always reached — unlike an add,
// where `addFamilyAtomsToSet` decides.
export const collectDeletedGroup = (
    collector: TreeTriggerCollector,
    data: StoreData,
    group: TreeTriggerGroup,
    timestamp: number,
): OwnStyleGroup => {
    const collected = collectOwnStyleGroup(collector, data, group)
    const familyAtoms = collected.familyAtoms
    if (familyAtoms) {
        const subs = collector.directSubs[collected.index]!
        const { selectors, provenance } = collector
        for (const [family, atoms] of familyAtoms) {
            const dependents = data.stateDependents.get(family)
            if (dependents && dependents.size > 0) {
                for (const dependent of dependents) {
                    if (!IS_PROD && data.architectureInstrumentation)
                        recordDependencyEdgeVisit(data)
                    selectors.add(dependent as Selector)
                    appendTreeProvenance(
                        provenance,
                        dependent as Selector,
                        collected.index,
                    )
                }
            }
            addSetToSet(data.subscriptions.get(family), subs)
            deleteFamilyAtomsFromSet(family, atoms, data, timestamp)
        }
    }
    return collected
}

const sealViolation = (message: string): never => {
    throw new Error(`valdres: tree trigger collection — ${message}`)
}

// Engine self-check at the phase A→B boundary. The types stop phase B from
// extending the collection; this catches a phase-A collection path that broke
// the invariants the indices rest on — a group pushed without going through
// `pushTreeGroup` (desynchronized parallel arrays), or a provenance chain that
// is empty, out of range, or not ascending (phase C reads `chain[0]` as "first
// reached", and `treeEqualAcrossGroups` consults the chain in reaching order).
//
// Dev-only, like `assertPlanLegal`: `build.ts` defines
// `VALDRES_ENGINE_SELF_CHECKS` as "off" so the guarding branch folds and this
// whole graph is tree-shaken out of the published bundle. Call it INLINE behind
// `if (!IS_PROD && process.env.VALDRES_ENGINE_SELF_CHECKS !== "off")` — only the
// inline form folds.
export const assertTreeTriggersSealed = (collector: TreeTriggerCollector) => {
    const groupCount = collector.groups.length
    if (
        collector.directSubs.length !== groupCount ||
        collector.membershipChanged.length !== groupCount
    )
        sealViolation("parallel arrays desynchronized; use pushTreeGroup")
    for (const chain of collector.provenance.values()) {
        if (chain.length === 0) sealViolation("empty provenance chain")
        let previous = -1
        for (const index of chain) {
            if (index < 0 || index >= groupCount)
                sealViolation("provenance index outside the group list")
            if (index <= previous)
                sealViolation("provenance chain is not ascending")
            previous = index
        }
    }
}
