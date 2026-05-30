import { describe, test } from "./test-compat"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atom as valdresAtom } from "../../src/atom"
import { store as valdresCreateStore } from "../../src/store"
import { assertFaster } from "./bench-utils"

// Prevent dead-code elimination by the JIT
let sink: any

describe("atom", () => {
    test("creation", async () => {
        await assertFaster(
            "atom(1)",
            () => { sink = valdresAtom(1) },
            () => { sink = jotaiAtom(1) },
            2.0,
        )
    })

    test("get", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()
        const vAtom = valdresAtom("hello")
        const jAtom = jotaiAtom("hello")

        await assertFaster(
            "store.get(atom)",
            () => { sink = vStore.get(vAtom) },
            () => { sink = jStore.get(jAtom) },
            1.5,
        )
    })

    test("set (new value)", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)

        let vInt = 0
        let jInt = 0
        await assertFaster(
            "set(atom, value)",
            () => vStore.set(vAtom, ++vInt),
            () => jStore.set(jAtom, ++jInt),
            2.0,
        )
    })

    test("set (updater function)", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)

        await assertFaster(
            "set(atom, curr => curr+1)",
            () => vStore.set(vAtom, (c: number) => c + 1),
            () => jStore.set(jAtom, (c: number) => c + 1),
            2.0,
        )
    })

    test("set with 10 subscribers", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)
        for (let i = 0; i < 10; i++) {
            vStore.sub(vAtom, () => {})
            jStore.sub(jAtom, () => {})
        }

        let vInt = 0
        let jInt = 0
        await assertFaster(
            "set(atom) with 10 subs",
            () => vStore.set(vAtom, ++vInt),
            () => jStore.set(jAtom, ++jInt),
            2.0,
        )
    })

    // Hot reads in valdres core (atom.equal, atom.onSet, atom.maxAge, …)
    // used to hit a megamorphic IC across atoms built from varied option
    // combinations because each spread produced a distinct hidden class.
    // After the shape-stability refactor, options-bearing atoms share one
    // shape — this bench exercises that exact pattern by cycling through
    // 8 distinct option combos and measuring set+read across all of them.
    test("set + read 100 atoms with varied options", async () => {
        const count = 100
        const valdresOptionsRing = [
            { name: "v0" },
            { name: "v1", mutable: true },
            { name: "v2", onSet: () => {} },
            { name: "v3", onMount: () => () => {} },
            { name: "v4", mutable: true, onSet: () => {} },
            { name: "v5", mutable: true, onMount: () => () => {} },
            { name: "v6", onSet: () => {}, onMount: () => () => {} },
            { name: "v7", mutable: true, onSet: () => {}, onMount: () => () => {} },
        ]

        const vStore = valdresCreateStore()
        const vAtoms = Array.from({ length: count }, (_, i) =>
            valdresAtom(0, valdresOptionsRing[i & 7]),
        )
        vAtoms.forEach(a => vStore.get(a))

        // Jotai equivalent: post-construction mutation of debugLabel and
        // onMount, which similarly diversifies its hidden classes. Same
        // 8-cycle pattern so both sides hit comparable shape variance.
        const jStore = jotaiCreateStore()
        const jAtoms = Array.from({ length: count }, (_, i) => {
            const a: any = jotaiAtom(0)
            a.debugLabel = `j${i & 7}`
            if (i & 1) a.onMount = (setSelf: any) => () => {}
            return a
        })
        jAtoms.forEach(a => jStore.get(a))

        let vInt = 0
        let jInt = 0
        await assertFaster(
            "set + read 100 atoms with varied options",
            () => {
                vInt++
                for (let i = 0; i < count; i++) vStore.set(vAtoms[i], vInt)
                for (let i = 0; i < count; i++) sink = vStore.get(vAtoms[i])
            },
            () => {
                jInt++
                for (let i = 0; i < count; i++) jStore.set(jAtoms[i], jInt)
                for (let i = 0; i < count; i++) sink = jStore.get(jAtoms[i])
            },
            2.0,
        )
    })

    test("lifecycle: create + 100 get + 100 set", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()

        await assertFaster(
            "atom lifecycle (create+100get+100set)",
            () => {
                const a = valdresAtom(0)
                for (let i = 0; i < 100; i++) sink = vStore.get(a)
                for (let i = 0; i < 100; i++) vStore.set(a, i)
            },
            () => {
                const a = jotaiAtom(0)
                for (let i = 0; i < 100; i++) sink = jStore.get(a)
                for (let i = 0; i < 100; i++) jStore.set(a, i)
            },
            2.0,
        )
    })
})
