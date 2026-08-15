import { describe, test } from "./test-compat"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atom as valdresAtom } from "../../src/atom"
import { store as valdresCreateStore } from "../../src/store"
import { compare } from "./bench-utils"
import { do_not_optimize } from "mitata"

describe("store", () => {
    test("creation", async () => {
        // TODO: valdres store creation is heavy — optimization target
        await compare(
            "createStore",
            () => do_not_optimize(valdresCreateStore()),
            () => do_not_optimize(jotaiCreateStore()),
        )
    })

    test("create and release many root stores", async () => {
        const storeCount = 1_000

        // Jotai stores have no disposal API. Its row is the conventional
        // creation reference; the Valdres row additionally performs the
        // required terminal cleanup so repeated samples do not retain roots.
        await compare(
            "create + dispose 1,000 root stores",
            () => {
                const stores = Array.from({ length: storeCount }, () =>
                    valdresCreateStore(),
                )
                do_not_optimize(stores)
                for (const store of stores) store.dispose()
            },
            () => {
                do_not_optimize(
                    Array.from({ length: storeCount }, () =>
                        jotaiCreateStore(),
                    ),
                )
            },
        )
    })

    test("bulk set: 1000 atoms", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()

        const vAtoms = Array.from({ length: 1000 }, () => valdresAtom(0))
        const jAtoms = Array.from({ length: 1000 }, () => jotaiAtom(0))

        await compare(
            "set 1000 atoms",
            () => {
                for (let i = 0; i < 1000; i++) vStore.set(vAtoms[i], i)
            },
            () => {
                for (let i = 0; i < 1000; i++) jStore.set(jAtoms[i], i)
            },
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

        await compare(
            "get 1000 atoms",
            () => {
                for (let i = 0; i < 1000; i++)
                    do_not_optimize(vStore.get(vAtoms[i]))
            },
            () => {
                for (let i = 0; i < 1000; i++)
                    do_not_optimize(jStore.get(jAtoms[i]))
            },
        )
    })

    test("subscribe + unsubscribe", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)
        const noop = () => {}

        // TODO: subscribe is slow — optimization target
        await compare(
            "sub + unsub",
            () => {
                const unsub = vStore.sub(vAtom, noop)
                unsub()
            },
            () => {
                const unsub = jStore.sub(jAtom, noop)
                unsub()
            },
        )
    })
})
