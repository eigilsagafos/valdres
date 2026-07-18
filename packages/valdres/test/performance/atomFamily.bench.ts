import { describe, test } from "./test-compat"
import { atom as jotaiAtom, createStore as jotaiCreateStore } from "jotai"
import { atomFamily as jotaiAtomFamily } from "jotai/utils"
import { atom as valdresAtom } from "../../src/atom"
import { atomFamily as valdresAtomFamily } from "../../src/atomFamily"
import { selectorFamily as valdresSelectorFamily } from "../../src/selectorFamily"
import { store as valdresCreateStore } from "../../src/store"
import { compare } from "./bench-utils"
import { do_not_optimize } from "mitata"

describe("atomFamily", () => {
    test("create atoms from family", async () => {
        const vFamily = valdresAtomFamily<string, [number]>(
            id => `user-${id}`,
        )
        const jFamily = jotaiAtomFamily((id: number) => jotaiAtom(`user-${id}`))

        let vCounter = 0
        let jCounter = 0
        await compare(
            "atomFamily(id)",
            () => do_not_optimize(vFamily(++vCounter)),
            () => do_not_optimize(jFamily(++jCounter)),
        )
    })
})

describe("atomFamily cache hit", () => {
    test("atomFamily cache hit", async () => {
        const vFamily = valdresAtomFamily<string, [number]>(
            id => `user-${id}`,
        )
        const jFamily = jotaiAtomFamily((id: number) => jotaiAtom(`user-${id}`))

        // Prime the cache
        vFamily(1)
        jFamily(1)

        // valdres's atomFamily cache hit is ~2x slower than jotai's on quiet
        // hardware (a known optimization target). It sits near the timer-
        // resolution floor (~16ns), so its absolute latency is noisy; Bencher's
        // t-test widens the band accordingly — tracked, not tightly gated.
        await compare(
            "atomFamily(id) cache hit",
            () => do_not_optimize(vFamily(1)),
            () => do_not_optimize(jFamily(1)),
        )
    })
})

describe("atomFamily membership maintenance", () => {
    test("update 5,000 existing members in one transaction", async () => {
        const memberCount = 5_000

        const vStore = valdresCreateStore()
        const vFamily = valdresAtomFamily<number, [number]>(0)
        const vMembers = Array.from({ length: memberCount }, (_, i) =>
            vFamily(i),
        )
        vStore.txn(txn => {
            txn.batchSetFamilyAtoms(
                vFamily,
                vMembers.map(member => [member, 0]),
            )
        })

        const jStore = jotaiCreateStore()
        const jFamily = jotaiAtomFamily((id: number) => jotaiAtom(id))
        const jMembers = Array.from({ length: memberCount }, (_, i) =>
            jFamily(i),
        )
        for (const member of jMembers) jStore.set(member, 0)

        let vValue = 0
        let jValue = 0
        await compare(
            "atomFamily: txn update 5,000 existing members",
            () => {
                const value = ++vValue
                vStore.txn(txn => {
                    for (const member of vMembers) txn.set(member, value)
                })
            },
            () => {
                const value = ++jValue
                for (const member of jMembers) jStore.set(member, value)
            },
        )
    })
})

describe("selectorFamily", () => {
    test("create selectors from family", async () => {
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)

        const vFamily = valdresSelectorFamily<number, [number]>(
            (id) => (get) => get(vAtom) + id,
        )
        const jFamily = jotaiAtomFamily((id: number) =>
            jotaiAtom(get => get(jAtom) + id),
        )

        let vCounter = 0
        let jCounter = 0
        await compare(
            "selectorFamily(id)",
            () => do_not_optimize(vFamily(++vCounter)),
            () => do_not_optimize(jFamily(++jCounter)),
        )
    })
})
