import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import { getStoreData } from "./getStoreData"
import type { Selector } from "../types/Selector"
import {
    appendTreeProvenance,
    assertTreeTriggersSealed,
    collectInheritedGroup,
    collectOwnStyleGroup,
    createTreeTriggerCollector,
    firstProvenanceOf,
    pushTreeGroup,
    treeEqualAcrossGroups,
    TREE_GROUP_GLOBAL,
    TREE_GROUP_INHERITED,
    TREE_GROUP_UPDATED,
    type TreeTriggerGroup,
} from "./treeTriggerGroups"

/**
 * Phase-ordering contract for the cross-scope settlement collector.
 *
 * `settleTreeStore` collects (phase A), settles (phase B), then assembles
 * subscribers and reports (phase C). Three invariants used to hold only because
 * of statement order inside that one function; extracting the collector turned
 * them into a cross-function contract, so they are pinned here:
 *
 *   1. `groups`, `directSubs` and `membershipChanged` are index-parallel.
 *      `pushTreeGroup` is the sole writer that keeps them so.
 *   2. Every provenance chain is ASCENDING, non-empty, and indexes a real
 *      group. Phase C reads `chain[0]` as "the group that first reached this
 *      selector" and `treeEqualAcrossGroups` walks the chain in reaching order,
 *      so a reversed chain silently reattributes subscribers and reports and
 *      hands the public `equal` predicate the wrong trigger set.
 *   3. Only an OWN-STYLE group has a `directSubs` slot. An inherited group's
 *      direct subscriptions are delegated to the owning ancestor store, so the
 *      steps that write into that slot must never be aimed at one — which is
 *      why they take the `OwnStyleGroup` object rather than a bare index.
 *
 * `assertTreeTriggersSealed` is the engine self-check for 1 and 2 at the A→B
 * boundary; it is compiled out of the published bundle.
 */

const group = (atoms: any[]): TreeTriggerGroup => ({
    kind: TREE_GROUP_UPDATED,
    atoms,
    set: undefined,
    report: undefined,
})

describe("tree trigger collector", () => {
    test("pushTreeGroup extends all three parallel arrays together", () => {
        const collector = createTreeTriggerCollector()
        expect(pushTreeGroup(collector, group([]))).toBe(0)
        expect(pushTreeGroup(collector, group([]))).toBe(1)
        expect(collector.groups).toHaveLength(2)
        expect(collector.directSubs).toEqual([undefined, undefined])
        expect(collector.membershipChanged).toEqual([undefined, undefined])
        assertTreeTriggersSealed(collector)
    })

    test("the seal rejects a group appended without pushTreeGroup", () => {
        const collector = createTreeTriggerCollector()
        pushTreeGroup(collector, group([]))
        // Exactly what a future collection path that builds its own group would
        // do. The arrays now disagree, so every index past this point may read
        // another group's subscriber set.
        collector.groups.push(group([]))
        expect(() => assertTreeTriggersSealed(collector)).toThrow(
            /parallel arrays desynchronized/,
        )
    })

    test("provenance stays ascending however the groups arrive", () => {
        const collector = createTreeTriggerCollector()
        for (let i = 0; i < 4; i++) pushTreeGroup(collector, group([]))
        const target = {} as Selector
        // Out-of-order appends are the normal case: a downstream merge hands a
        // dependent the groups of whichever parent changed first.
        for (const index of [2, 0, 3, 0, 1]) {
            appendTreeProvenance(collector.provenance, target, index)
        }
        expect(collector.provenance.get(target)).toEqual([0, 1, 2, 3])
        expect(firstProvenanceOf(collector, target)).toBe(0)
        assertTreeTriggersSealed(collector)
    })

    test("the seal rejects an empty, out-of-range or descending chain", () => {
        const base = () => {
            const collector = createTreeTriggerCollector()
            pushTreeGroup(collector, group([]))
            pushTreeGroup(collector, group([]))
            return collector
        }
        const target = {} as Selector

        const empty = base()
        empty.provenance.set(target, [])
        expect(() => assertTreeTriggersSealed(empty)).toThrow(
            /empty provenance chain/,
        )

        const outOfRange = base()
        outOfRange.provenance.set(target, [0, 2])
        expect(() => assertTreeTriggersSealed(outOfRange)).toThrow(
            /outside the group list/,
        )

        // The ordering regression this file exists for: reverse a chain and the
        // seal fails instead of letting phase C attribute the selector to the
        // last group that reached it.
        const descending = base()
        descending.provenance.set(target, [1, 0])
        expect(() => assertTreeTriggersSealed(descending)).toThrow(
            /not ascending/,
        )
    })

    test("group order decides which trigger set `equal` is consulted with", () => {
        const collector = createTreeTriggerCollector()
        const first = { id: "first" }
        const second = { id: "second" }
        pushTreeGroup(collector, {
            kind: TREE_GROUP_GLOBAL,
            atoms: [first as any],
            set: undefined,
            report: undefined,
        })
        pushTreeGroup(collector, group([second]))
        collector.baseUnion.add(first as any)
        collector.baseUnion.add(second as any)

        const seen: unknown[][] = []
        const target = {
            equal: (_a: unknown, _b: unknown, triggers: Set<any>) => {
                seen.push([...triggers])
                return true
            },
        } as unknown as Selector
        appendTreeProvenance(collector.provenance, target, 0)
        appendTreeProvenance(collector.provenance, target, 1)

        expect(
            treeEqualAcrossGroups(collector, target, 1, 1, collector.baseUnion),
        ).toBe(true)
        // Reaching order, one set per reaching group — the historical
        // per-pass trigger sets, not their union.
        expect(seen).toEqual([[first], [second]])
    })

    test("an atom initialized during the settlement joins the LAST group's set", () => {
        const collector = createTreeTriggerCollector()
        const trigger = { id: "trigger" }
        const lazy = { id: "lazy" }
        pushTreeGroup(collector, group([trigger]))
        collector.baseUnion.add(trigger as any)

        const seen: unknown[][] = []
        const target = {
            equal: (_a: unknown, _b: unknown, triggers: Set<any>) => {
                seen.push([...triggers])
                return true
            },
        } as unknown as Selector
        appendTreeProvenance(collector.provenance, target, 0)

        // The live evaluation set is larger than the static base union: `lazy`
        // was materialized by the selector body. That comparison is why the
        // base union must be frozen at the A→B boundary.
        const live = new Set<any>([trigger, lazy])
        expect(treeEqualAcrossGroups(collector, target, 1, 1, live)).toBe(true)
        expect(seen).toEqual([[trigger, lazy]])
    })

    test("only an own-style group gets a directSubs slot", () => {
        const root = store("collector-slots")
        const data = getStoreData(root)
        const source = atom(0, { label: "source" })
        const view = selector(get => get(source) + 1, { label: "view" })
        root.sub(source, () => {})
        root.sub(view, () => {})

        const collector = createTreeTriggerCollector()
        const own = collectOwnStyleGroup(collector, data, group([source]))
        collectInheritedGroup(collector, data, {
            kind: TREE_GROUP_INHERITED,
            atoms: [source],
            set: undefined,
            report: undefined,
        })

        // Own-style: direct subscribers collected. Inherited: none — they are
        // delegated to the ancestor that owns the atom.
        expect(collector.directSubs[own.index]?.size).toBe(1)
        expect(collector.directSubs[1]).toBeUndefined()
        // Both reach the dependent selector, in ascending group order.
        expect(firstProvenanceOf(collector, view as any)).toBe(0)
        expect(collector.provenance.get(view as any)).toEqual([0, 1])
        assertTreeTriggersSealed(collector)
        root.dispose()
    })

    test("a family member add records membership only on its own group", () => {
        const root = store("collector-membership")
        const data = getStoreData(root)
        const family = atomFamily<number, string>(0, { label: "family" })
        const listing = selector(get => get(family).length, {
            label: "listing",
        })
        root.sub(listing, () => {})

        const collector = createTreeTriggerCollector()
        const own = collectOwnStyleGroup(collector, data, group([family("a")]))
        expect(own.familyAtoms?.size).toBe(1)
        // Membership slots stay per-group: nothing is recorded before
        // applyFamilyAdds runs for THIS group's index.
        expect(collector.membershipChanged[own.index]).toBeUndefined()
        assertTreeTriggersSealed(collector)
        root.dispose()
    })
})
