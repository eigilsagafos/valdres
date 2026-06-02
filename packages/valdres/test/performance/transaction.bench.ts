import { describe, test } from "./test-compat"
import { do_not_optimize } from "mitata"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atom as valdresAtom } from "../../src/atom"
import { selector as valdresSelector } from "../../src/selector"
import { store as valdresCreateStore } from "../../src/store"
import { compare } from "./bench-utils"

describe("transaction", () => {
    test("10 atoms × 10 selectors each, batch set + read all", async () => {
        const atomCount = 10
        const selectorsPerAtom = 10

        // --- valdres setup ---
        const vStore = valdresCreateStore()
        const vAtoms = Array.from({ length: atomCount }, () =>
            valdresAtom(0),
        )
        const vSelectors = vAtoms.flatMap(a =>
            Array.from({ length: selectorsPerAtom }, (_, i) =>
                valdresSelector(get => get(a) + i),
            ),
        )
        vSelectors.forEach(s => vStore.get(s))

        // --- jotai setup ---
        const jStore = jotaiCreateStore()
        const jAtoms = Array.from({ length: atomCount }, () =>
            jotaiAtom(0),
        )
        const jSelectors = jAtoms.flatMap(a =>
            Array.from({ length: selectorsPerAtom }, (_, i) =>
                jotaiAtom(get => get(a) + i),
            ),
        )
        jSelectors.forEach(s => jStore.get(s))

        let vInt = 0
        let jInt = 0

        await compare(
            "txn: 10 atoms × 10 selectors, set + read",
            () => {
                const val = ++vInt
                vStore.txn(txn => {
                    for (const a of vAtoms) txn.set(a, val)
                })
                for (const s of vSelectors) do_not_optimize(vStore.get(s))
            },
            () => {
                const val = ++jInt
                for (const a of jAtoms) jStore.set(a, val)
                for (const s of jSelectors) do_not_optimize(jStore.get(s))
            },
        )
    })

    test("10 atoms × 10 selectors each, with subscribers", async () => {
        const atomCount = 10
        const selectorsPerAtom = 10

        // --- valdres setup ---
        const vStore = valdresCreateStore()
        const vAtoms = Array.from({ length: atomCount }, () =>
            valdresAtom(0),
        )
        const vSelectors = vAtoms.flatMap(a =>
            Array.from({ length: selectorsPerAtom }, (_, i) =>
                valdresSelector(get => get(a) + i),
            ),
        )
        vSelectors.forEach(s => vStore.sub(s, () => {}))

        // --- jotai setup ---
        const jStore = jotaiCreateStore()
        const jAtoms = Array.from({ length: atomCount }, () =>
            jotaiAtom(0),
        )
        const jSelectors = jAtoms.flatMap(a =>
            Array.from({ length: selectorsPerAtom }, (_, i) =>
                jotaiAtom(get => get(a) + i),
            ),
        )
        jSelectors.forEach(s => jStore.sub(s, () => {}))

        let vInt = 0
        let jInt = 0

        await compare(
            "txn: 10 atoms × 10 selectors, with subs",
            () => {
                const val = ++vInt
                vStore.txn(txn => {
                    for (const a of vAtoms) txn.set(a, val)
                })
            },
            () => {
                const val = ++jInt
                for (const a of jAtoms) jStore.set(a, val)
            },
        )
    })

    test("10 atoms × 100 selectors each, batch set + read all", async () => {
        const atomCount = 10
        const selectorsPerAtom = 100

        // --- valdres setup ---
        const vStore = valdresCreateStore()
        const vAtoms = Array.from({ length: atomCount }, () =>
            valdresAtom(0),
        )
        const vSelectors = vAtoms.flatMap(a =>
            Array.from({ length: selectorsPerAtom }, (_, i) =>
                valdresSelector(get => get(a) + i),
            ),
        )
        vSelectors.forEach(s => vStore.get(s))

        // --- jotai setup ---
        const jStore = jotaiCreateStore()
        const jAtoms = Array.from({ length: atomCount }, () =>
            jotaiAtom(0),
        )
        const jSelectors = jAtoms.flatMap(a =>
            Array.from({ length: selectorsPerAtom }, (_, i) =>
                jotaiAtom(get => get(a) + i),
            ),
        )
        jSelectors.forEach(s => jStore.get(s))

        let vInt = 0
        let jInt = 0

        await compare(
            "txn: 10 atoms × 100 selectors, set + read",
            () => {
                const val = ++vInt
                vStore.txn(txn => {
                    for (const a of vAtoms) txn.set(a, val)
                })
                for (const s of vSelectors) do_not_optimize(vStore.get(s))
            },
            () => {
                const val = ++jInt
                for (const a of jAtoms) jStore.set(a, val)
                for (const s of jSelectors) do_not_optimize(jStore.get(s))
            },
        )
    })

    test("cross-atom selectors: 10 atoms, 100 selectors each reading 3 atoms", async () => {
        const atomCount = 10

        // --- valdres setup ---
        const vStore = valdresCreateStore()
        const vAtoms = Array.from({ length: atomCount }, () =>
            valdresAtom(0),
        )
        // Each selector depends on 3 atoms (current, next, next+1 wrapping)
        const vSelectors = Array.from({ length: atomCount * 100 }, (_, i) => {
            const a0 = vAtoms[i % atomCount]
            const a1 = vAtoms[(i + 1) % atomCount]
            const a2 = vAtoms[(i + 2) % atomCount]
            return valdresSelector(get => get(a0) + get(a1) + get(a2))
        })
        vSelectors.forEach(s => vStore.get(s))

        // --- jotai setup ---
        const jStore = jotaiCreateStore()
        const jAtoms = Array.from({ length: atomCount }, () =>
            jotaiAtom(0),
        )
        const jSelectors = Array.from({ length: atomCount * 100 }, (_, i) => {
            const a0 = jAtoms[i % atomCount]
            const a1 = jAtoms[(i + 1) % atomCount]
            const a2 = jAtoms[(i + 2) % atomCount]
            return jotaiAtom(get => get(a0) + get(a1) + get(a2))
        })
        jSelectors.forEach(s => jStore.get(s))

        let vInt = 0
        let jInt = 0

        await compare(
            "txn: cross-atom 1000 selectors, set + read",
            () => {
                const val = ++vInt
                vStore.txn(txn => {
                    for (const a of vAtoms) txn.set(a, val)
                })
                for (const s of vSelectors) do_not_optimize(vStore.get(s))
            },
            () => {
                const val = ++jInt
                for (const a of jAtoms) jStore.set(a, val)
                for (const s of jSelectors) do_not_optimize(jStore.get(s))
            },
        )
    })

    test("asymmetric DAG: shared sink reachable through paths of different depth", async () => {
        // Asymmetric reachability is the case where dedup actually pays off:
        // a "sink" selector depends both directly on the source AND on a
        // chain of intermediate selectors that also depend on the source.
        // Pre-dedup, the BFS pass re-evaluated the sink once at each depth
        // it was reachable from; post-dedup, the sink (and every internal
        // node reachable at multiple depths) evaluates exactly once.
        //
        // Topology: chain x_1 → x_2 → ... → x_N reading source atom A
        // (each x_i reads x_{i-1}, and x_1 reads A). One "sink" selector
        // reads A AND every x_i, so it sits at the bottom of N differently-
        // sized paths from A.
        const chainLen = 20

        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const vChain: any[] = []
        let vPrev: any = vAtom
        for (let i = 0; i < chainLen; i++) {
            const dep = vPrev
            vChain.push(valdresSelector(get => get(dep) + 1))
            vPrev = vChain[i]
        }
        const vSink = valdresSelector(get =>
            vChain.reduce(
                (acc: number, s: any) => acc + get(s),
                get(vAtom),
            ),
        )
        vStore.sub(vSink, () => {})

        const jStore = jotaiCreateStore()
        const jAtom = jotaiAtom(0)
        const jChain: any[] = []
        let jPrev: any = jAtom
        for (let i = 0; i < chainLen; i++) {
            const dep = jPrev
            jChain.push(jotaiAtom(get => get(dep) + 1))
            jPrev = jChain[i]
        }
        const jSink = jotaiAtom(get =>
            jChain.reduce(
                (acc: number, s: any) => acc + get(s),
                get(jAtom),
            ),
        )
        jStore.sub(jSink, () => {})

        let vInt = 0
        let jInt = 0

        await compare(
            "txn: asymmetric DAG shared sink",
            () => {
                vStore.set(vAtom, ++vInt)
            },
            () => {
                jStore.set(jAtom, ++jInt)
            },
        )
    })

    test("large asymmetric DAG: 1000 leaves over a 50-link chain", async () => {
        // 50-link chain: x_1 → x_2 → ... → x_50, each chain link reads the
        // previous one (or the source atom for x_1).
        //
        // 1000 leaf selectors, each subscribed. Every leaf reads the source
        // atom directly AND a strided subset of the chain (~10 links per
        // leaf), so each leaf sits at the convergence of many paths with
        // wildly different lengths from the source.
        //
        // Pre-dedup BFS re-evaluates each leaf once per chain link it
        // reads (~10×). Post-dedup, each leaf evaluates at most twice
        // (once in the initial sweep, once in the topo settle).
        const chainLen = 50
        const leafCount = 1000

        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)
        const vChain: any[] = []
        let vPrev: any = vAtom
        for (let i = 0; i < chainLen; i++) {
            const dep = vPrev
            vChain.push(valdresSelector(get => get(dep) + 1))
            vPrev = vChain[i]
        }
        const vLeaves = Array.from({ length: leafCount }, (_, i) =>
            valdresSelector(get => {
                let sum = get(vAtom)
                for (let j = i % 5; j < chainLen; j += 5) {
                    sum += get(vChain[j])
                }
                return sum
            }),
        )
        vLeaves.forEach(s => vStore.sub(s, () => {}))

        const jStore = jotaiCreateStore()
        const jAtom = jotaiAtom(0)
        const jChain: any[] = []
        let jPrev: any = jAtom
        for (let i = 0; i < chainLen; i++) {
            const dep = jPrev
            jChain.push(jotaiAtom(get => get(dep) + 1))
            jPrev = jChain[i]
        }
        const jLeaves = Array.from({ length: leafCount }, (_, i) =>
            jotaiAtom(get => {
                let sum = get(jAtom)
                for (let j = i % 5; j < chainLen; j += 5) {
                    sum += get(jChain[j])
                }
                return sum
            }),
        )
        jLeaves.forEach(s => jStore.sub(s, () => {}))

        let vInt = 0
        let jInt = 0

        await compare(
            "txn: large asymmetric DAG (1000 leaves × 50 chain)",
            () => {
                vStore.set(vAtom, ++vInt)
            },
            () => {
                jStore.set(jAtom, ++jInt)
            },
        )
    })

    test("cross-atom selectors with subscribers", async () => {
        const atomCount = 10

        // --- valdres setup ---
        const vStore = valdresCreateStore()
        const vAtoms = Array.from({ length: atomCount }, () =>
            valdresAtom(0),
        )
        const vSelectors = Array.from({ length: atomCount * 100 }, (_, i) => {
            const a0 = vAtoms[i % atomCount]
            const a1 = vAtoms[(i + 1) % atomCount]
            const a2 = vAtoms[(i + 2) % atomCount]
            return valdresSelector(get => get(a0) + get(a1) + get(a2))
        })
        vSelectors.forEach(s => vStore.sub(s, () => {}))

        // --- jotai setup ---
        const jStore = jotaiCreateStore()
        const jAtoms = Array.from({ length: atomCount }, () =>
            jotaiAtom(0),
        )
        const jSelectors = Array.from({ length: atomCount * 100 }, (_, i) => {
            const a0 = jAtoms[i % atomCount]
            const a1 = jAtoms[(i + 1) % atomCount]
            const a2 = jAtoms[(i + 2) % atomCount]
            return jotaiAtom(get => get(a0) + get(a1) + get(a2))
        })
        jSelectors.forEach(s => jStore.sub(s, () => {}))

        let vInt = 0
        let jInt = 0

        await compare(
            "txn: cross-atom 1000 selectors, with subs",
            () => {
                const val = ++vInt
                vStore.txn(txn => {
                    for (const a of vAtoms) txn.set(a, val)
                })
            },
            () => {
                const val = ++jInt
                for (const a of jAtoms) jStore.set(a, val)
            },
        )
    })
})
