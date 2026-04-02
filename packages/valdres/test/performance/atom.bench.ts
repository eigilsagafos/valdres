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
})
