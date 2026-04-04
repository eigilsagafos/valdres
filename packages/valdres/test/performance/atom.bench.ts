import { describe, test } from "bun:test"
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
