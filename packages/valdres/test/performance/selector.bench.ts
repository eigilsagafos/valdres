import { describe, test } from "./test-compat"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atom as valdresAtom } from "../../src/atom"
import { selector as valdresSelector } from "../../src/selector"
import { store as valdresCreateStore } from "../../src/store"
import { assertFaster } from "./bench-utils"

let sink: any

describe("selector", () => {
    test("creation", async () => {
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)
        await assertFaster(
            "selector(fn)",
            () => { sink = valdresSelector(get => get(vAtom) + 1) },
            () => { sink = jotaiAtom(get => get(jAtom) + 1) },
            2.0,
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
        await assertFaster(
            "set + read 10 selectors",
            () => {
                vStore.set(vAtom, ++vInt)
                vSelectors.forEach(s => vStore.get(s))
            },
            () => {
                jStore.set(jAtom, ++jInt)
                jSelectors.forEach(s => jStore.get(s))
            },
            2.0,
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
        await assertFaster(
            "set + read 100 selectors",
            () => {
                vStore.set(vAtom, ++vInt)
                vSelectors.forEach(s => vStore.get(s))
            },
            () => {
                jStore.set(jAtom, ++jInt)
                jSelectors.forEach(s => jStore.get(s))
            },
            2.0,
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
            await assertFaster(
                `sub+unsub on chain of ${N} unsubscribed derived deps`,
                () => {
                    const store = valdresCreateStore()
                    const base = valdresAtom(0)
                    let prev: any = base
                    for (let i = 0; i < N; i++) {
                        const dep = prev
                        prev = valdresSelector(get => get(dep) + 1)
                    }
                    store.get(prev)
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
                    store.get(prev)
                    const u = store.sub(base, () => {})
                    u()
                },
                2.0,
            )
        })
    }

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
        await assertFaster(
            "set + read through 5 chained selectors",
            () => {
                vStore.set(vBase, ++vInt)
                vStore.get(vFinal)
            },
            () => {
                jStore.set(jBase, ++jInt)
                jStore.get(jFinal)
            },
            2.0,
        )
    })
})
