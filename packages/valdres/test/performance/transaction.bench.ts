import { describe, test } from "./test-compat"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atom as valdresAtom } from "../../src/atom"
import { selector as valdresSelector } from "../../src/selector"
import { store as valdresCreateStore } from "../../src/store"
import { assertFaster } from "./bench-utils"

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

        await assertFaster(
            "txn: 10 atoms × 10 selectors, set + read",
            () => {
                const val = ++vInt
                vStore.txn(txn => {
                    for (const a of vAtoms) txn.set(a, val)
                })
                for (const s of vSelectors) vStore.get(s)
            },
            () => {
                const val = ++jInt
                for (const a of jAtoms) jStore.set(a, val)
                for (const s of jSelectors) jStore.get(s)
            },
            2.0,
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

        await assertFaster(
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
            2.0,
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

        await assertFaster(
            "txn: 10 atoms × 100 selectors, set + read",
            () => {
                const val = ++vInt
                vStore.txn(txn => {
                    for (const a of vAtoms) txn.set(a, val)
                })
                for (const s of vSelectors) vStore.get(s)
            },
            () => {
                const val = ++jInt
                for (const a of jAtoms) jStore.set(a, val)
                for (const s of jSelectors) jStore.get(s)
            },
            2.0,
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

        await assertFaster(
            "txn: cross-atom 1000 selectors, set + read",
            () => {
                const val = ++vInt
                vStore.txn(txn => {
                    for (const a of vAtoms) txn.set(a, val)
                })
                for (const s of vSelectors) vStore.get(s)
            },
            () => {
                const val = ++jInt
                for (const a of jAtoms) jStore.set(a, val)
                for (const s of jSelectors) jStore.get(s)
            },
            2.0,
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

        await assertFaster(
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
            2.0,
        )
    })
})
