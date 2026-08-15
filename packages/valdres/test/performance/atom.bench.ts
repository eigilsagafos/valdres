import { describe, test } from "./test-compat"
import { createStore as jotaiCreateStore, atom as jotaiAtom } from "jotai"
import { atom as valdresAtom } from "../../src/atom"
import { store as valdresCreateStore } from "../../src/store"
import { compare, measureOne } from "./bench-utils"
import { do_not_optimize } from "mitata"

describe("atom", () => {
    test("creation", async () => {
        await compare(
            "atom(1)",
            () => do_not_optimize(valdresAtom(1)),
            () => do_not_optimize(jotaiAtom(1)),
        )
    })

    test("get", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()
        const vAtom = valdresAtom("hello")
        const jAtom = jotaiAtom("hello")

        await compare(
            "store.get(atom)",
            () => do_not_optimize(vStore.get(vAtom)),
            () => do_not_optimize(jStore.get(jAtom)),
        )
    })

    test("set (new value)", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)

        let vInt = 0
        let jInt = 0
        await compare(
            "set(atom, value)",
            () => vStore.set(vAtom, ++vInt),
            () => jStore.set(jAtom, ++jInt),
        )
    })

    test("set (updater function)", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)

        await compare(
            "set(atom, curr => curr+1)",
            () => vStore.set(vAtom, (c: number) => c + 1),
            () => jStore.set(jAtom, (c: number) => c + 1),
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
        await compare(
            "set(atom) with 10 subs",
            () => vStore.set(vAtom, ++vInt),
            () => jStore.set(jAtom, ++jInt),
        )
    })

    test("set a large structurally equal value", async () => {
        // Valdres's default equality is structural, whereas Jotai's default is
        // referential. A head-to-head row would therefore measure different
        // semantics, so keep this Valdres-specific path on measureOne(). The
        // two values are built outside the timed region: this isolates the
        // complete default-equality walk and equal-write short circuit.
        const rowCount = 1_024
        const makeRows = () =>
            Array.from({ length: rowCount }, (_, id) => ({
                id,
                profile: { active: id % 2 === 0, score: id * 3 },
                tags: [`group-${id % 16}`, `shard-${id % 64}`],
            }))
        const current = makeRows()
        const equalCopy = makeRows()
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(current)
        vStore.get(vAtom)

        await measureOne(
            "set equal structural value (1,024 rows) / valdres",
            () => vStore.set(vAtom, equalCopy),
        )
    })

    test("lifecycle: create + 100 get + 100 set", async () => {
        const vStore = valdresCreateStore()
        const jStore = jotaiCreateStore()

        await compare(
            "atom lifecycle (create+100get+100set)",
            () => {
                const a = valdresAtom(0)
                for (let i = 0; i < 100; i++) do_not_optimize(vStore.get(a))
                for (let i = 0; i < 100; i++) vStore.set(a, i)
            },
            () => {
                const a = jotaiAtom(0)
                for (let i = 0; i < 100; i++) do_not_optimize(jStore.get(a))
                for (let i = 0; i < 100; i++) jStore.set(a, i)
            },
        )
    })
})
