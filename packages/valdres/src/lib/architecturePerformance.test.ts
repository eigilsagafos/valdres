import { describe, expect, mock, test } from "bun:test"
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
import { cacheController } from "./cacheController"
import { getStoreData } from "./getStoreData"
import { mockAsyncSource, withFakeClock } from "../../test/utils/fakeClock"

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
            schedulerWorkAllocations: 0,
            livenessWorkAllocations: 0,
            schedulerCycleFallbacks: 0,
            livenessEdgeVisits: 0,
            mountEdgeVisits: 0,
            mountTransitions: 0,
            unmountTransitions: 0,
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
        target.set(source, -1)

        const counts = measureArchitecture(target, () => target.set(source, 1))
        reportCounts("Live fan-out, width 8", counts)

        expect(counts.selectorEvaluations).toBe(width)
        expect(counts.selectorSettlements).toBe(width)
        expect(counts.duplicateSelectorSettlements).toBe(0)
        expect(counts.affectedStoresSettled).toBe(1)
        expect(counts.storeSettlementPasses).toBe(1)
        expect(counts.duplicateStoreSettlements).toBe(0)
        expectBetween(counts.dependencyEdgeVisits, width, width * 1.5)
        expect(counts.schedulerQueueEnqueues).toBe(0)
        expect(counts.schedulerQueueDequeues).toBe(0)
        expect(counts.schedulerWorkAllocations).toBe(0)
        expect(counts.livenessWorkAllocations).toBe(0)

        for (const cleanup of cleanups) cleanup()
    })

    test("unchanged multi-seed writes do not discover downstream closure", () => {
        const depth = 200
        const target = store()
        const source = atom(0)
        const left = selector(get => {
            get(source)
            return 0
        })
        const right = selector(get => {
            get(source)
            return 0
        })
        let sink: any = left
        for (let index = 0; index < depth; index++) {
            const dependency = sink
            sink = selector(get => get(dependency) + 1)
        }
        const cleanupSink = target.sub(sink, noop)
        const cleanupRight = target.sub(right, noop)
        target.set(source, -1)

        const counts = measureArchitecture(target, () => target.set(source, 1))
        reportCounts("Unchanged multi-seed closure", counts)

        expect(counts.selectorEvaluations).toBe(2)
        expect(counts.selectorSettlements).toBe(2)
        expect(counts.duplicateSelectorSettlements).toBe(0)
        expectBetween(counts.dependencyEdgeVisits, 2, 8)
        expect(counts.schedulerQueueEnqueues).toBe(0)
        expect(counts.schedulerQueueDequeues).toBe(0)
        expect(counts.schedulerWorkAllocations).toBe(0)

        cleanupRight()
        cleanupSink()
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
        target.set(source, -1)

        const counts = measureArchitecture(target, () => target.set(source, 1))
        reportCounts("Asymmetric DAG, depth 6", counts)

        // The closure scheduler waits for every in-closure dependency, so the
        // wide sink settles once against the finalized six-link chain.
        expect(counts.selectorEvaluations).toBe(7)
        expect(counts.selectorSettlements).toBe(7)
        expect(counts.duplicateSelectorSettlements).toBe(0)
        expectBetween(counts.dependencyEdgeVisits, 37, 42)
        expect(counts.schedulerQueueEnqueues).toBe(8)
        expect(counts.schedulerQueueDequeues).toBe(
            counts.schedulerQueueEnqueues,
        )
        expect(counts.schedulerWorkAllocations).toBe(0)
        expect(counts.schedulerCycleFallbacks).toBe(0)
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
        target.set(toggle, false)

        const counts = measureArchitecture(target, () =>
            target.set(toggle, true),
        )
        reportCounts("Dynamic churn, width 6", counts)

        expect(counts.selectorEvaluations).toBe(width)
        expect(counts.selectorSettlements).toBe(width)
        expect(counts.duplicateSelectorSettlements).toBe(0)
        expect(counts.affectedStoresSettled).toBe(1)
        expectBetween(counts.dependencyEdgeVisits, width, width * 2)
        expect(counts.schedulerQueueEnqueues).toBe(0)
        expect(counts.schedulerQueueDequeues).toBe(0)
        expect(counts.schedulerWorkAllocations).toBe(0)
        // The one-array count walks intentionally stay local: pooling them
        // regresses subscribe/unsubscribe despite avoiding these two arrays.
        expect(counts.livenessWorkAllocations).toBe(2)

        for (const cleanup of cleanups) cleanup()
    })

    test("dynamic mount churn keeps lifecycle transitions exact", () => {
        let mounts = 0
        let cleanups = 0
        const target = store()
        const toggle = atom(true)
        const left = atom(1, {
            onMount: () => {
                mounts++
                return () => {
                    cleanups++
                }
            },
        })
        const right = atom(2, {
            onMount: () => {
                mounts++
                return () => {
                    cleanups++
                }
            },
        })
        const dynamic = selector(get => (get(toggle) ? get(left) : get(right)))
        const cleanup = target.sub(dynamic, noop)
        target.set(toggle, false)
        const mountsBefore = mounts
        const cleanupsBefore = cleanups

        const counts = measureArchitecture(target, () =>
            target.set(toggle, true),
        )
        reportCounts("Dynamic mount churn", counts)

        expect(mounts - mountsBefore).toBe(1)
        expect(cleanups - cleanupsBefore).toBe(1)
        expect(counts.mountTransitions).toBe(1)
        expect(counts.unmountTransitions).toBe(1)
        expect(counts.schedulerWorkAllocations).toBe(0)
        // The measured-faster local count and mount walks keep their six
        // short-lived containers; only multi-container reconciliation is pooled.
        expect(counts.livenessWorkAllocations).toBe(6)
        expect(counts.livenessEdgeVisits).toBe(0)
        expect(counts.mountEdgeVisits).toBe(0)

        cleanup()
    })

    test("re-entrant mount writes use a distinct warm scheduler frame", () => {
        let mounts = 0
        let cleanups = 0
        const target = store()
        const gate = atom(false)
        const innerSource = atom(0)
        const innerLeft = selector(get => get(innerSource) + 1)
        const innerRight = selector(get => get(innerLeft) + 1)
        const innerSink = selector(get => get(innerLeft) + get(innerRight))
        const mounted = atom(10, {
            onMount: () => {
                mounts++
                target.set(innerSource, mounts)
                return () => {
                    cleanups++
                }
            },
        })
        const dynamic = selector(get => (get(gate) ? get(mounted) : 0))
        const peer = selector(get => get(dynamic) + (get(gate) ? 1 : 0))
        const outerSink = selector(get => get(dynamic) + get(peer))
        const cleanupInner = target.sub(innerSink, noop)
        const cleanupOuter = target.sub(outerSink, noop)

        // First pass creates the outer and nested frames; the false transition
        // releases both before the measured warm re-entry.
        target.set(gate, true)
        target.set(gate, false)
        const counts = measureArchitecture(target, () => target.set(gate, true))
        reportCounts("Re-entrant mount write", counts)

        expect(mounts).toBe(2)
        expect(cleanups).toBe(1)
        expect(target.get(dynamic)).toBe(10)
        expect(target.get(peer)).toBe(11)
        expect(target.get(innerLeft)).toBe(3)
        expect(target.get(innerRight)).toBe(4)
        expect(target.get(innerSink)).toBe(7)
        expect(target.get(outerSink)).toBe(21)
        expect(counts.selectorEvaluations).toBe(6)
        expect(counts.duplicateSelectorSettlements).toBe(0)
        expect(counts.schedulerWorkAllocations).toBe(0)
        expect(counts.livenessWorkAllocations).toBe(3)
        expect(counts.mountTransitions).toBe(1)
        expect(counts.unmountTransitions).toBe(0)

        cleanupOuter()
        cleanupInner()
    })

    test("cyclic closures iterate fallback waves to a stable fixpoint", () => {
        const target = store()
        const warmSource = atom(0)
        const warmLeft = selector(get => get(warmSource))
        const warmRight = selector(get => get(warmSource))
        const warmSink = selector(get => get(warmLeft) + get(warmRight))
        const cleanupWarm = target.sub(warmSink, noop)
        target.set(warmSource, 1)

        const drive = atom(0)
        const entry = selector(get => get(drive))
        let cyclicRight: any
        const cyclicLeft = selector(get =>
            get(entry) > 0 ? get(cyclicRight) : 0,
        )
        cyclicRight = selector(get => Math.min(get(cyclicLeft) + 1, 9))
        const cleanupLeft = target.sub(cyclicLeft, noop)
        const cleanupRight = target.sub(cyclicRight, noop)

        const counts = measureArchitecture(target, () => target.set(drive, 1))
        reportCounts("Cyclic closure fallback", counts)

        expect(target.get(entry)).toBe(1)
        expect(target.get(cyclicLeft)).toBe(9)
        expect(target.get(cyclicRight)).toBe(9)
        expect(counts.schedulerCycleFallbacks).toBeGreaterThan(0)
        expect(counts.schedulerWorkAllocations).toBe(0)

        cleanupRight()
        cleanupLeft()
        cleanupWarm()
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
        expect(counts.commitPlanRuns).toBe(1)
        expectBetween(counts.dependencyEdgeVisits, width, width + 2)
        expect(selectors.map((derived, i) => stores[i]!.get(derived))).toEqual(
            Array.from({ length: width }, (_, i) => i + 1),
        )
        for (const target of stores) target.dispose()
    })

    test("unobserved global roots use the no-graph fast path", () => {
        const shared = atom(0, { global: true })
        const stores = Array.from({ length: 6 }, () => store())
        stores.forEach(target => target.get(shared))

        const counts = measureArchitecture(stores, () =>
            stores[0]!.set(shared, 1),
        )

        expect(counts.commitPlanRuns).toBe(0)
        expect(counts.storeSettlementPasses).toBe(0)
        expect(counts.selectorSettlements).toBe(0)
        expect(stores.map(target => target.get(shared))).toEqual(
            Array(stores.length).fill(1),
        )
        for (const target of stores) target.dispose()
    })

    test("global reset and resetSelf each admit one visit-once forest plan", () => {
        const shared = atom(0, { global: true })
        const first = store()
        const child = first.scope("reset-child")
        const peer = store()
        const stores = [first, child, peer]
        const selectors = stores.map(target => {
            const derived = selector(get => get(shared) + 1)
            target.sub(derived, noop)
            return derived
        })
        first.set(shared, 4)

        const reset = measureArchitecture([first, peer], () =>
            first.reset(shared),
        )
        expect(reset.commitPlanRuns).toBe(1)
        expect(reset.duplicateStoreSettlements).toBe(0)
        expect(reset.duplicateSelectorSettlements).toBe(0)

        first.set(shared, 9)
        const resetSelf = measureArchitecture([first, peer], () =>
            shared.resetSelf(),
        )
        expect(resetSelf.commitPlanRuns).toBe(1)
        expect(resetSelf.duplicateStoreSettlements).toBe(0)
        expect(resetSelf.duplicateSelectorSettlements).toBe(0)
        expect(selectors.map((derived, i) => stores[i]!.get(derived))).toEqual([
            1, 1, 1,
        ])
        first.dispose()
        peer.dispose()
    })

    test("global max-age meta-on, value, and meta-off are three forest plans", () =>
        withFakeClock(async clock => {
            const source = mockAsyncSource<number>()
            const shared = atom(source.fn as unknown as () => number, {
                global: true,
                maxAge: 100,
            })
            const first = store()
            const second = store()
            const unsubFirst = first.sub(shared, noop)
            const unsubSecond = second.sub(shared, noop)
            await source.resolve(1)

            const instrumentation = createArchitectureInstrumentation()
            const firstData = getStoreData(first)
            const secondData = getStoreData(second)
            firstData.architectureInstrumentation = instrumentation
            secondData.architectureInstrumentation = instrumentation
            try {
                await clock.advance(100)
                await source.resolve(2)
            } finally {
                delete firstData.architectureInstrumentation
                delete secondData.architectureInstrumentation
            }

            expect(instrumentation.counters.commitPlanRuns).toBe(3)
            expect(instrumentation.counters.duplicateStoreSettlements).toBe(0)
            expect(instrumentation.counters.duplicateSelectorSettlements).toBe(
                0,
            )
            unsubFirst()
            unsubSecond()
            first.dispose()
            second.dispose()
        }))

    test("local max-age meta-on, value, and meta-off are three plans", () =>
        withFakeClock(async clock => {
            const source = mockAsyncSource<number>()
            const cached = atom(source.fn as unknown as () => number, {
                maxAge: 100,
            })
            const target = store()
            const unsubscribe = target.sub(cached, noop)
            await source.resolve(1)

            const instrumentation = createArchitectureInstrumentation()
            const data = getStoreData(target)
            data.architectureInstrumentation = instrumentation
            try {
                await clock.advance(100)
                await source.resolve(2)
            } finally {
                delete data.architectureInstrumentation
            }

            expect(instrumentation.counters.commitPlanRuns).toBe(3)
            expect(instrumentation.counters.duplicateStoreSettlements).toBe(0)
            unsubscribe()
            target.dispose()
        }))

    test("lazy max-age expiry stays outside CommitPlan and notifications", () =>
        withFakeClock(async clock => {
            let reads = 0
            const cached = atom(() => ++reads, { maxAge: 100 })
            const unrelated = atom(0)
            const target = store()
            const initial = target.get(cached)
            const subscriber = mock(() => {})
            const unsubscribeState = target.sub(unrelated, subscriber)
            const onChange = mock(() => {})
            const unsubscribeChange = target.onChange(onChange)
            const onCommitEnd = mock(() => {})
            const unsubscribeCommit = target.onCommitEnd(onCommitEnd)

            await clock.advance(101)
            const instrumentation = createArchitectureInstrumentation()
            const data = getStoreData(target)
            data.architectureInstrumentation = instrumentation
            let expired: boolean
            try {
                expired = cacheController.expireIfStale(cached, data)
            } finally {
                delete data.architectureInstrumentation
            }

            expect(expired!).toBe(true)
            expect(data.values.has(cached)).toBe(false)
            expect(reads).toBe(1)
            expect(subscriber).not.toHaveBeenCalled()
            expect(onChange).not.toHaveBeenCalled()
            expect(onCommitEnd).not.toHaveBeenCalled()
            expect(instrumentation.counters.commitPlanRuns).toBe(0)

            // The following ordinary initialization owns any publication.
            expect(target.get(cached)).not.toBe(initial)
            expect(reads).toBe(2)

            unsubscribeState()
            unsubscribeChange()
            unsubscribeCommit()
            target.dispose()
        }))

    test("ordinary subscriptions do not materialize the cache sidecar", () => {
        const target = store()
        const plain = atom(0)
        const data = getStoreData(target)
        expect(Object.hasOwn(data, "cache")).toBe(false)

        const unsubscribe = target.sub(plain, noop)
        expect(Object.hasOwn(data, "cache")).toBe(false)

        unsubscribe()
        expect(Object.hasOwn(data, "cache")).toBe(false)
        target.dispose()
    })
})
