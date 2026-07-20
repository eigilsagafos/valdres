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

    test("deep cross-scope transactions expose repeated settlement passes", () => {
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

        expect(counts.selectorEvaluations).toBe(3)
        expect(counts.selectorSettlements).toBe(3)
        expect(counts.duplicateSelectorSettlements).toBe(2)
        expect(counts.affectedStoresSettled).toBe(1)
        expect(counts.storeSettlementPasses).toBe(3)
        expect(counts.duplicateStoreSettlements).toBe(2)
        cleanup()
        root.dispose()
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
