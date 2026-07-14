import { describe, test } from "./test-compat"
import { do_not_optimize } from "mitata"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atomFamily as jotaiAtomFamily } from "jotai/utils"
import { atom as valdresAtom } from "../../src/atom"
import { selector as valdresSelector } from "../../src/selector"
import { selectorFamily as valdresSelectorFamily } from "../../src/selectorFamily"
import { store as valdresCreateStore } from "../../src/store"
import { compare } from "./bench-utils"

const makeSharedTeardown = (count: number, fanIn: boolean) => {
    const vStore = valdresCreateStore()
    const vSpineRoot = valdresAtom(0)
    let vSpineTop: any = valdresSelector(get => get(vSpineRoot) + 1)
    for (let depth = 1; depth < 20; depth++) {
        const previous = vSpineTop
        vSpineTop = valdresSelector(get => get(previous) + 1)
    }
    const vPairs = Array.from({ length: count }, (_, index) => {
        const base = valdresAtom(index)
        const a = valdresSelector(get => get(base) + get(vSpineTop))
        const b = valdresSelector(get => get(a) + 1)
        const c = valdresSelector(get => get(b) + 1)
        return { b, c }
    })
    const vAggregator = fanIn
        ? valdresSelector(get => {
              let sum = 0
              for (const { c } of vPairs) sum += get(c)
              return sum
          })
        : undefined

    const jStore = jotaiCreateStore()
    const jSpineRoot = jotaiAtom(0)
    let jSpineTop: any = jotaiAtom(get => get(jSpineRoot) + 1)
    for (let depth = 1; depth < 20; depth++) {
        const previous = jSpineTop
        jSpineTop = jotaiAtom(get => get(previous) + 1)
    }
    const jPairs = Array.from({ length: count }, (_, index) => {
        const base = jotaiAtom(index)
        const a = jotaiAtom(get => get(base) + get(jSpineTop))
        const b = jotaiAtom(get => get(a) + 1)
        const c = jotaiAtom(get => get(b) + 1)
        return { b, c }
    })
    const jAggregator = fanIn
        ? jotaiAtom(get => {
              let sum = 0
              for (const { c } of jPairs) sum += get(c)
              return sum
          })
        : undefined

    const noop = () => {}
    return {
        valdres: async () => {
            const unsubs: (() => void)[] = []
            for (const { b, c } of vPairs) {
                unsubs.push(vStore.sub(c, noop))
                unsubs.push(vStore.sub(b, noop))
                do_not_optimize(vStore.get(c))
                do_not_optimize(vStore.get(b))
            }
            if (vAggregator) {
                unsubs.push(vStore.sub(vAggregator, noop))
                do_not_optimize(vStore.get(vAggregator))
            }
            for (const unsub of unsubs) unsub()
            await Promise.resolve()
        },
        jotai: async () => {
            const unsubs: (() => void)[] = []
            for (const { b, c } of jPairs) {
                unsubs.push(jStore.sub(c, noop))
                unsubs.push(jStore.sub(b, noop))
                do_not_optimize(jStore.get(c))
                do_not_optimize(jStore.get(b))
            }
            if (jAggregator) {
                unsubs.push(jStore.sub(jAggregator, noop))
                do_not_optimize(jStore.get(jAggregator))
            }
            for (const unsub of unsubs) unsub()
            // Match the async measurement boundary used to include Valdres's
            // queued orphan sweep in every iteration.
            await Promise.resolve()
        },
    }
}

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

    for (const fanIn of [false, true]) {
        test(`subscribe + unsubscribe 100 shared selector pairs${fanIn ? " + fan-in" : ""}`, async () => {
            const teardown = makeSharedTeardown(100, fanIn)
            await compare(
                `subscribe + unsubscribe 100 shared selector pairs${fanIn ? " + fan-in" : ""}`,
                teardown.valdres,
                teardown.jotai,
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
})
