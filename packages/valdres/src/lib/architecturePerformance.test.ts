import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import type { Store } from "../types/Store"
import type { StoreData } from "../types/StoreData"
import {
    createArchitectureInstrumentation,
    type ArchitectureCounters,
} from "./architectureInstrumentation"
import { getStoreData } from "./getStoreData"

const noop = () => {}

const measureArchitecture = (
    stores: Store | Store[],
    operation: () => void,
): ArchitectureCounters => {
    const instrumentation = createArchitectureInstrumentation()
    const roots = (Array.isArray(stores) ? stores : [stores]).map(getStoreData)
    const attached = new Set<StoreData>()

    const attachTree = (root: StoreData) => {
        const queue = [root]
        for (let i = 0; i < queue.length; i++) {
            const data = queue[i]!
            if (attached.has(data)) continue
            attached.add(data)
            data.architectureInstrumentation = instrumentation
            for (const child of data.scopes.values()) queue.push(child)
        }
    }

    for (const root of roots) attachTree(root)
    try {
        operation()
    } finally {
        // Include scopes created during the measured operation before removing
        // the collector, so no test-only strong reference survives the window.
        for (const root of roots) attachTree(root)
        for (const data of attached) {
            delete data.architectureInstrumentation
        }
    }
    return { ...instrumentation.counters }
}

const expectBetween = (actual: number, min: number, max: number) => {
    expect(actual).toBeGreaterThanOrEqual(min)
    expect(actual).toBeLessThanOrEqual(max)
}

const reportCounts = (scenario: string, counts: ArchitectureCounters) => {
    if (process.env.ARCHITECTURE_REPORT === "1") {
        console.log(JSON.stringify({ scenario, ...counts }))
    }
}

describe("deterministic architecture performance gates", () => {
    test("atom-only writes stay off selector and scheduler paths", () => {
        const target = store()
        const value = atom(0)
        target.get(value)

        const counts = measureArchitecture(target, () => target.set(value, 1))
        reportCounts("Atom-only write", counts)

        expect(counts).toEqual({
            selectorEvaluations: 0,
            selectorSettlements: 0,
            duplicateSelectorSettlements: 0,
            affectedStoresSettled: 0,
            storeSettlementPasses: 0,
            duplicateStoreSettlements: 0,
            dependencyEdgeVisits: 0,
            schedulerQueueEnqueues: 0,
            schedulerQueueDequeues: 0,
            // A scalar direct write settles without an engine plan.
            commitPlanRuns: 0,
        })
    })

    test("live selector fan-out is linear and settles once", () => {
        const width = 8
        const target = store()
        const source = atom(0)
        const selectors = Array.from({ length: width }, (_, offset) =>
            selector(get => get(source) + offset),
        )
        const cleanups = selectors.map(derived => target.sub(derived, noop))

        const counts = measureArchitecture(target, () => target.set(source, 1))
        reportCounts("Live fan-out, width 8", counts)

        expect(counts.selectorEvaluations).toBe(width)
        expect(counts.selectorSettlements).toBe(width)
        expect(counts.duplicateSelectorSettlements).toBe(0)
        expect(counts.affectedStoresSettled).toBe(1)
        expect(counts.storeSettlementPasses).toBe(1)
        expect(counts.duplicateStoreSettlements).toBe(0)
        expectBetween(counts.dependencyEdgeVisits, width * 2, width * 2.5)
        expectBetween(counts.schedulerQueueEnqueues, width, width + 2)
        expect(counts.schedulerQueueDequeues).toBe(
            counts.schedulerQueueEnqueues,
        )

        for (const cleanup of cleanups) cleanup()
    })

    test("asymmetric DAG queue and edge work remains bounded", () => {
        const target = store()
        const source = atom(0)
        const chain = []
        let previous: any = source
        for (let i = 0; i < 6; i++) {
            const dependency = previous
            const derived = selector(get => get(dependency) + 1)
            chain.push(derived)
            previous = derived
        }
        const sink = selector(get =>
            chain.reduce((sum, derived) => sum + get(derived), get(source)),
        )
        const cleanup = target.sub(sink, noop)

        const counts = measureArchitecture(target, () => target.set(source, 1))
        reportCounts("Asymmetric DAG, depth 6", counts)

        // The wide sink is reached in the initial sweep and once after its
        // chain settles. That one repeat is the current correctness-preserving
        // baseline; the gate prevents it from growing with path count.
        expect(counts.selectorEvaluations).toBe(8)
        expect(counts.selectorSettlements).toBe(8)
        expect(counts.duplicateSelectorSettlements).toBe(1)
        expectBetween(counts.dependencyEdgeVisits, 36, 50)
        expectBetween(counts.schedulerQueueEnqueues, 7, 10)
        expect(counts.schedulerQueueDequeues).toBe(
            counts.schedulerQueueEnqueues,
        )
        cleanup()
    })

    test("dynamic dependency churn stays one evaluation per live selector", () => {
        const width = 6
        const target = store()
        const toggle = atom(true)
        const left = atom(1)
        const right = atom(2)
        const selectors = Array.from({ length: width }, () =>
            selector(get => (get(toggle) ? get(left) : get(right))),
        )
        const cleanups = selectors.map(derived => target.sub(derived, noop))

        const counts = measureArchitecture(target, () =>
            target.set(toggle, false),
        )
        reportCounts("Dynamic churn, width 6", counts)

        expect(counts.selectorEvaluations).toBe(width)
        expect(counts.selectorSettlements).toBe(width)
        expect(counts.duplicateSelectorSettlements).toBe(0)
        expect(counts.affectedStoresSettled).toBe(1)
        expectBetween(counts.dependencyEdgeVisits, width * 3, width * 4)
        expectBetween(counts.schedulerQueueEnqueues, width, width + 2)
        expect(counts.schedulerQueueDequeues).toBe(
            counts.schedulerQueueEnqueues,
        )

        for (const cleanup of cleanups) cleanup()
    })

    test("single-store transactions execute exactly one commit plan per shape", () => {
        const ordinaryStore = store()
        const ordinaryAtom = atom(0)
        const ordinary = measureArchitecture(ordinaryStore, () => {
            ordinaryStore.txn(txn => txn.set(ordinaryAtom, 1))
        })
        expect(ordinary.commitPlanRuns).toBe(1)

        const hookedStore = store()
        const hookedAtom = atom(0, { onSet: noop })
        const hooked = measureArchitecture(hookedStore, () => {
            hookedStore.txn(txn => txn.set(hookedAtom, 1))
        })
        expect(hooked.commitPlanRuns).toBe(1)

        const cleanupStore = store()
        const cleanupAtom = atom(0)
        const removedAtom = atom(1)
        cleanupStore.set(removedAtom, 2)
        const cleanup = measureArchitecture(cleanupStore, () => {
            cleanupStore.txn(txn => {
                txn.set(cleanupAtom, 1)
                txn.unset(removedAtom)
            })
        })
        expect(cleanup.commitPlanRuns).toBe(1)
    })

    test("a deliberately duplicated single-store settlement is detected", () => {
        const target = store()
        const family = atomFamily<string>(undefined)
        const first = family("first")
        const second = family("second")
        const value = atom(0)
        target.set(first, "a")
        target.set(second, "b")
        const spanning = selector(get => `${get(family).length}:${get(value)}`)
        const cleanup = target.sub(spanning, noop)

        const counts = measureArchitecture(target, () => {
            target.txn(txn => {
                txn.del(second)
                txn.set(value, 1)
            })
        })
        reportCounts("Single-store update + delete", counts)

        expect(counts.selectorEvaluations).toBe(2)
        expect(counts.selectorSettlements).toBe(2)
        expect(counts.duplicateSelectorSettlements).toBe(1)
        expect(counts.affectedStoresSettled).toBe(1)
        expect(counts.storeSettlementPasses).toBe(2)
        expect(counts.duplicateStoreSettlements).toBe(1)
        cleanup()
    })

    test("deep cross-scope transactions settle each affected store once", () => {
        const root = store()
        const level1 = root.scope("level-1")
        const level2 = level1.scope("level-2")
        const rootValue = atom(0)
        const level1Value = atom(0)
        const level2Value = atom(0)
        level1.set(level1Value, 0)
        level2.set(level2Value, 0)
        const spanning = selector(
            get => get(rootValue) + get(level1Value) + get(level2Value),
        )
        const cleanup = level2.sub(spanning, noop)

        const counts = measureArchitecture(root, () => {
            root.txn(txn => {
                txn.set(rootValue, 1)
                txn.scope("level-1", level1Txn => {
                    level1Txn.set(level1Value, 2)
                    level1Txn.scope("level-2", level2Txn => {
                        level2Txn.set(level2Value, 3)
                    })
                })
            })
        })
        reportCounts("Cross-scope transaction, depth 3", counts)

        // The tree-level CommitPlan visits each store once with the union of
        // its own and inherited triggers, so the spanning selector evaluates
        // once for the whole commit — not once per reaching ancestor pass.
        expect(counts.selectorEvaluations).toBe(1)
        expect(counts.selectorSettlements).toBe(1)
        expect(counts.duplicateSelectorSettlements).toBe(0)
        expect(counts.affectedStoresSettled).toBe(1)
        expect(counts.storeSettlementPasses).toBe(1)
        expect(counts.duplicateStoreSettlements).toBe(0)
        expect(counts.commitPlanRuns).toBe(1)
        cleanup()
        root.dispose()
    })

    test("cross-scope update + delete + unset settles the spanning selector once", () => {
        // The union walk covers every mutation kind in one per-store
        // settlement: a selector depending on an updated root atom, a
        // root-deleted family member, AND a scope-unset atom evaluates once.
        const root = store()
        const scope = root.scope("mixed")
        const family = atomFamily<string>(undefined)
        const first = family("first")
        const second = family("second")
        root.set(first, "a")
        root.set(second, "b")
        const rootValue = atom(0)
        const scopeValue = atom(0)
        scope.set(scopeValue, 7)
        const spanning = selector(
            get => `${get(family).length}:${get(rootValue)}:${get(scopeValue)}`,
        )
        const cleanup = scope.sub(spanning, noop)
        expect(scope.get(spanning)).toBe("2:0:7")

        const counts = measureArchitecture(root, () => {
            root.txn(txn => {
                txn.del(second)
                txn.set(rootValue, 1)
                txn.scope("mixed", scopeTxn => scopeTxn.unset(scopeValue))
            })
        })
        reportCounts("Cross-scope update + delete + unset", counts)

        expect(scope.get(spanning)).toBe("1:1:0")
        expect(counts.selectorEvaluations).toBe(1)
        expect(counts.selectorSettlements).toBe(1)
        expect(counts.duplicateSelectorSettlements).toBe(0)
        expect(counts.storeSettlementPasses).toBe(1)
        expect(counts.duplicateStoreSettlements).toBe(0)
        expect(counts.commitPlanRuns).toBe(1)
        cleanup()
        root.dispose()
    })

    test("global-containing cross-scope transactions run one commit plan", () => {
        const shared = atom(0, { global: true })
        const origin = store()
        const scope = origin.scope("g-scope")
        const scoped = atom(0)
        scope.set(scoped, 0)
        const peer = store()
        peer.get(shared)

        const counts = measureArchitecture([origin, peer], () => {
            origin.txn(txn => {
                txn.set(shared, 1)
                txn.scope("g-scope", scopeTxn => scopeTxn.set(scoped, 2))
            })
        })
        reportCounts("Cross-scope transaction with global peer", counts)

        expect(counts.commitPlanRuns).toBe(1)
        expect(peer.get(shared)).toBe(1)
        expect(scope.get(scoped)).toBe(2)
        origin.dispose()
        peer.dispose()
    })

    test("a global peer that is also a plan store settles once", () => {
        // The plan root touches the global atom (making it a fan-out peer of
        // the scope's write) AND carries its own local write. The peer update
        // folds into the root's single tree-walk settlement — a spanning
        // selector evaluates once, never once in a peer pass plus once in the
        // walk.
        const shared = atom(0, { global: true })
        const origin = store()
        const scope = origin.scope("gp-scope")
        const local = atom(0)
        origin.get(shared) // origin is now an attached peer of `shared`
        const outside = store()
        outside.get(shared) // a genuine non-plan peer keeps the legacy pass
        const spanning = selector(get => get(local) + get(shared))
        const cleanup = origin.sub(spanning, noop)
        origin.get(spanning)

        const counts = measureArchitecture([origin, outside], () => {
            origin.txn(txn => {
                txn.set(local, 1)
                txn.scope("gp-scope", scopeTxn => scopeTxn.set(shared, 5))
            })
        })
        reportCounts("Cross-scope txn, overlapping plan/peer store", counts)

        expect(origin.get(shared)).toBe(5)
        expect(outside.get(shared)).toBe(5)
        expect(origin.get(spanning)).toBe(6)
        expect(counts.selectorEvaluations).toBe(1)
        expect(counts.selectorSettlements).toBe(1)
        expect(counts.duplicateSelectorSettlements).toBe(0)
        expect(counts.storeSettlementPasses).toBe(1)
        expect(counts.duplicateStoreSettlements).toBe(0)
        expect(counts.commitPlanRuns).toBe(1)
        cleanup()
        origin.dispose()
        outside.dispose()
    })

    test("global fan-out settles each affected store once", () => {
        const width = 6
        const shared = atom(0, { global: true })
        const stores = Array.from({ length: width }, () => store())
        const selectors = stores.map((target, offset) => {
            const derived = selector(get => get(shared) + offset)
            target.sub(derived, noop)
            return derived
        })

        const counts = measureArchitecture(stores, () =>
            stores[0]!.set(shared, 1),
        )
        reportCounts("Global fan-out, width 6", counts)

        expect(counts.selectorEvaluations).toBe(width)
        expect(counts.selectorSettlements).toBe(width)
        expect(counts.duplicateSelectorSettlements).toBe(0)
        expect(counts.affectedStoresSettled).toBe(width)
        expect(counts.storeSettlementPasses).toBe(width)
        expect(counts.duplicateStoreSettlements).toBe(0)
        expectBetween(counts.dependencyEdgeVisits, width, width + 2)
        expect(selectors.map((derived, i) => stores[i]!.get(derived))).toEqual(
            Array.from({ length: width }, (_, i) => i + 1),
        )
        for (const target of stores) target.dispose()
    })
})
