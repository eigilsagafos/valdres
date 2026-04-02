import { describe, test } from "bun:test"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atom as valdresAtom } from "../../src/atom"
import { store as valdresCreateStore } from "../../src/store"
import { assertFaster } from "./bench-utils"

let sink: any

describe("store", () => {
    test("creation", async () => {
        // TODO: valdres store creation is heavy — optimization target
        await assertFaster(
            "createStore",
            () => { sink = valdresCreateStore() },
            () => { sink = jotaiCreateStore() },
            50.0,
        )
    })

    test("bulk set: 1000 atoms", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()

        const vAtoms = Array.from({ length: 1000 }, () => valdresAtom(0))
        const jAtoms = Array.from({ length: 1000 }, () => jotaiAtom(0))

        await assertFaster(
            "set 1000 atoms",
            () => {
                for (let i = 0; i < 1000; i++) vStore.set(vAtoms[i], i)
            },
            () => {
                for (let i = 0; i < 1000; i++) jStore.set(jAtoms[i], i)
            },
            2.0,
        )
    })

    test("bulk get: 1000 atoms", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()

        const vAtoms = Array.from({ length: 1000 }, (_, i) => {
            const a = valdresAtom(i)
            vStore.get(a)
            return a
        })
        const jAtoms = Array.from({ length: 1000 }, (_, i) => {
            const a = jotaiAtom(i)
            jStore.get(a)
            return a
        })

        await assertFaster(
            "get 1000 atoms",
            () => {
                for (let i = 0; i < 1000; i++) sink = vStore.get(vAtoms[i])
            },
            () => {
                for (let i = 0; i < 1000; i++) sink = jStore.get(jAtoms[i])
            },
            1.5,
        )
    })

    test("subscribe + unsubscribe", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)
        const noop = () => {}

        // TODO: subscribe is slow — optimization target
        await assertFaster(
            "sub + unsub",
            () => {
                const unsub = vStore.sub(vAtom, noop)
                unsub()
            },
            () => {
                const unsub = jStore.sub(jAtom, noop)
                unsub()
            },
            15.0,
        )
    })
})
