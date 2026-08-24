import { describe, test } from "./test-compat"
import { do_not_optimize } from "mitata"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atomFamily as jotaiAtomFamily } from "jotai/utils"
import { atom as valdresAtom } from "../../src/atom"
import { selector as valdresSelector } from "../../src/selector"
import { selectorFamily as valdresSelectorFamily } from "../../src/selectorFamily"
import { store as valdresCreateStore } from "../../src/store"
import { compare } from "./bench-utils"

describe("selector", () => {
    test("creation", async () => {
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)
        await compare(
            "selector(fn)",
            () => do_not_optimize(valdresSelector(get => get(vAtom) + 1)),
            () => do_not_optimize(jotaiAtom(get => get(jAtom) + 1)),
        )
    })

    test("set + read with 10 subscribers", async () => {
        const count = 10

        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const vSelectors = Array.from({ length: count }, (_, i) =>
            valdresSelector(get => get(vAtom) + i),
        )
        vSelectors.forEach(s => vStore.get(s))

        const jStore = jotaiCreateStore()
        const jAtom = jotaiAtom(0)
        const jSelectors = Array.from({ length: count }, (_, i) =>
            jotaiAtom(get => get(jAtom) + i),
        )
        jSelectors.forEach(s => jStore.get(s))

        let vInt = 0
        let jInt = 0
        await compare(
            "set + read 10 selectors",
            () => {
                vStore.set(vAtom, ++vInt)
                vSelectors.forEach(s => do_not_optimize(vStore.get(s)))
            },
            () => {
                jStore.set(jAtom, ++jInt)
                jSelectors.forEach(s => do_not_optimize(jStore.get(s)))
            },
        )
    })

    test("set + read with 100 subscribers", async () => {
        const count = 100

        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const vSelectors = Array.from({ length: count }, (_, i) =>
            valdresSelector(get => get(vAtom) + i),
        )
        vSelectors.forEach(s => vStore.get(s))

        const jStore = jotaiCreateStore()
        const jAtom = jotaiAtom(0)
        const jSelectors = Array.from({ length: count }, (_, i) =>
            jotaiAtom(get => get(jAtom) + i),
        )
        jSelectors.forEach(s => jStore.get(s))

        let vInt = 0
        let jInt = 0
        await compare(
            "set + read 100 selectors",
            () => {
                vStore.set(vAtom, ++vInt)
                vSelectors.forEach(s => do_not_optimize(vStore.get(s)))
            },
            () => {
                jStore.set(jAtom, ++jInt)
                jSelectors.forEach(s => do_not_optimize(jStore.get(s)))
            },
        )
    })

    // sub+unsub on a chain of derived atoms that were initialized but never
    // subscribed. The unsub path walks the dependent graph to clean up
    // orphaned nodes. Before the liveness cache landed, each visited node
    // ran isTransitivelySubscribed, which itself walked the remaining upper
    // graph — O(N²) total. The cache makes each check O(1). Build cost is
    // paid equally by both sides because we rebuild each iteration (cleanup
    // destroys the chain).
    for (const N of [50, 100, 500]) {
        test(`sub+unsub on chain of ${N} unsubscribed derived deps`, async () => {
            await compare(
                `sub+unsub on chain of ${N} unsubscribed derived deps`,
                () => {
                    const store = valdresCreateStore()
                    const base = valdresAtom(0)
                    let prev: any = base
                    for (let i = 0; i < N; i++) {
                        const dep = prev
                        prev = valdresSelector(get => get(dep) + 1)
                    }
                    do_not_optimize(store.get(prev))
                    const u = store.sub(base, () => {})
                    u()
                },
                () => {
                    const store = jotaiCreateStore()
                    const base = jotaiAtom(0)
                    let prev: any = base
                    for (let i = 0; i < N; i++) {
                        const dep = prev
                        prev = jotaiAtom(get => get(dep) + 1)
                    }
                    do_not_optimize(store.get(prev))
                    const u = store.sub(base, () => {})
                    u()
                },
            )
        })
    }

    test("set + read 100 selectorFamily entries", async () => {
        const count = 100

        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const vFamily = valdresSelectorFamily(
            (offset: number) => get => get(vAtom) + offset,
        )
        const vSelectors = Array.from({ length: count }, (_, i) => vFamily(i))
        vSelectors.forEach(s => vStore.get(s))

        const jStore = jotaiCreateStore()
        const jAtom = jotaiAtom(0)
        const jFamily = jotaiAtomFamily((offset: number) =>
            jotaiAtom(get => get(jAtom) + offset),
        )
        const jSelectors = Array.from({ length: count }, (_, i) => jFamily(i))
        jSelectors.forEach(s => jStore.get(s))

        let vInt = 0
        let jInt = 0
        await compare(
            "set + read 100 selectorFamily entries",
            () => {
                vStore.set(vAtom, ++vInt)
                vSelectors.forEach(s => do_not_optimize(vStore.get(s)))
            },
            () => {
                jStore.set(jAtom, ++jInt)
                jSelectors.forEach(s => do_not_optimize(jStore.get(s)))
            },
        )
    })

    test("chained selectors (depth 5)", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()

        const vBase = valdresAtom(0)
        let vPrev: any = vBase
        for (let i = 0; i < 5; i++) {
            const dep = vPrev
            vPrev = valdresSelector(get => get(dep) + 1)
        }
        const vFinal = vPrev
        vStore.get(vFinal)

        const jBase = jotaiAtom(0)
        let jPrev: any = jBase
        for (let i = 0; i < 5; i++) {
            const dep = jPrev
            jPrev = jotaiAtom(get => get(dep) + 1)
        }
        const jFinal = jPrev
        jStore.get(jFinal)

        let vInt = 0
        let jInt = 0
        await compare(
            "set + read through 5 chained selectors",
            () => {
                vStore.set(vBase, ++vInt)
                do_not_optimize(vStore.get(vFinal))
            },
            () => {
                jStore.set(jBase, ++jInt)
                do_not_optimize(jStore.get(jFinal))
            },
        )
    })

    // Every other benchmark in this suite reads each selector exactly ONCE, so
    // none of them can see a lost memoization — that is how the beta.20
    // "selector re-evaluates on every dependency read" regression shipped past
    // the bench gate. This models the workload that exposed it: a traversal
    // that revisits shared nodes, so each leaf is read many times per pass.
    //
    // Two details are load-bearing, both learned from that regression:
    //
    //  - The write goes to a `cursor` atom that ONLY the root reads. That makes
    //    the root re-evaluate and re-walk the graph while every leaf's inputs
    //    are unchanged, which is the exact condition memoization has to cover.
    //    Writing an atom the leaves depend on instead lets propagation settle
    //    them once and stop, and the re-read never happens.
    //  - The leaves resolve to `undefined` (an absent field on an entity — the
    //    shape the consumer had). `undefined` is also what a MISSING cache
    //    entry reads back as, so change-detection that confuses "absent" with
    //    "present and undefined" shows up here as O(reads) full re-evaluations
    //    instead of O(1).
    test("traversal re-reading shared leaves", async () => {
        const nodes = 20
        const visitsPerNode = 5
        // An entity record with no `duration` field, so each leaf resolves to
        // `undefined` by a plain property read — no per-read allocation that
        // would add noise unrelated to the property under measurement.
        const entity: { duration?: number } = {}

        const vStore = valdresCreateStore()
        const vSource = valdresAtom(entity)
        const vCursor = valdresAtom(0)
        const vLeaf = valdresSelectorFamily(
            (_id: number) => get => get(vSource).duration,
        )
        const vRoot = valdresSelector(get => {
            let visited = get(vCursor)
            for (let visit = 0; visit < visitsPerNode; visit++) {
                for (let id = 0; id < nodes; id++) {
                    do_not_optimize(get(vLeaf(id)))
                    visited++
                }
            }
            return visited
        })
        vStore.sub(vRoot, () => {})

        const jStore = jotaiCreateStore()
        const jSource = jotaiAtom(entity)
        const jCursor = jotaiAtom(0)
        const jLeaf = jotaiAtomFamily((_id: number) =>
            jotaiAtom(get => get(jSource).duration),
        )
        const jRoot = jotaiAtom(get => {
            let visited = get(jCursor)
            for (let visit = 0; visit < visitsPerNode; visit++) {
                for (let id = 0; id < nodes; id++) {
                    do_not_optimize(get(jLeaf(id)))
                    visited++
                }
            }
            return visited
        })
        jStore.sub(jRoot, () => {})

        let vInt = 0
        let jInt = 0
        await compare(
            "traversal: 20 leaves revisited 5x each",
            () => {
                vStore.set(vCursor, ++vInt)
                do_not_optimize(vStore.get(vRoot))
            },
            () => {
                jStore.set(jCursor, ++jInt)
                do_not_optimize(jStore.get(jRoot))
            },
        )
    })
})
