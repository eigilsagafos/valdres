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
        const vFamily = valdresAtomFamily<string, [number]>(id => `user-${id}`)
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
        const vFamily = valdresAtomFamily<string, [number]>(id => `user-${id}`)
        const jFamily = jotaiAtomFamily((id: number) => jotaiAtom(`user-${id}`))

        // Prime the cache
        vFamily(1)
        jFamily(1)

        // valdres's atomFamily cache hit is ~2x slower than jotai's on quiet
        // hardware (a known optimization target). It sits near the timer-
        // resolution floor (~16ns), so its absolute latency is noisy. It stays
        // in the raw history and plots but is excluded from both CI gates.
        await compare(
            "atomFamily(id) cache hit",
            () => do_not_optimize(vFamily(1)),
            () => do_not_optimize(jFamily(1)),
        )
    })

    test("atomFamily string cache hit", async () => {
        const vFamily = valdresAtomFamily<string, [string]>(id => `user-${id}`)
        const jFamily = jotaiAtomFamily((id: string) => jotaiAtom(`user-${id}`))

        vFamily("user-1")
        jFamily("user-1")

        // String keys require canonical encoding to stay disjoint from
        // structured keys. Guard the raw-string side cache that keeps encoding
        // off the steady-state lookup path.
        await compare(
            "atomFamily(string) cache hit",
            () => do_not_optimize(vFamily("user-1")),
            () => do_not_optimize(jFamily("user-1")),
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

    // Membership CHANGES outside a transaction: each `set`/`del` is its own
    // commit, so each one settles the family's membership on its own. The
    // transaction case above amortizes that over one commit; these two are the
    // event-handler shape — a loop of direct writes — and guard that the cost
    // of a write stays independent of how many members the family already has.
    //
    // Ordered AFTER the transaction case deliberately: both churn a store and
    // 500 member atoms per iteration, and the resulting heap pressure inflated
    // the next case in the same process by ~20% when they ran first. Appending
    // keeps the existing series measuring what it measured before.
    test("create 500 members with direct sets", async () => {
        const memberCount = 500

        const vFamily = valdresAtomFamily<number, [number]>(0)
        const vMembers = Array.from({ length: memberCount }, (_, i) =>
            vFamily(i),
        )
        const jFamily = jotaiAtomFamily((id: number) => jotaiAtom(id))
        const jMembers = Array.from({ length: memberCount }, (_, i) =>
            jFamily(i),
        )

        // A fresh store per iteration is what makes every member NEW: the
        // member atoms themselves are created once, outside the measurement.
        await compare(
            "atomFamily: direct set 500 new members",
            () => {
                const store = valdresCreateStore()
                for (const member of vMembers) store.set(member, 1)
            },
            () => {
                const store = jotaiCreateStore()
                for (const member of jMembers) store.set(member, 1)
            },
        )
    })

    test("create then delete 500 members with direct writes", async () => {
        const memberCount = 500

        const vFamily = valdresAtomFamily<number, [number]>(0)
        const vMembers = Array.from({ length: memberCount }, (_, i) =>
            vFamily(i),
        )
        const jFamily = jotaiAtomFamily((id: number) => jotaiAtom(id))

        // Deletion needs a populated store, and mitata has no per-iteration
        // setup hook, so the whole measured region is the create+delete CYCLE:
        // every operation inside it is the direct membership path under test,
        // with no bulk-populate step to subtract. Read alongside the create-only
        // case above to attribute a movement to one half or the other.
        //
        // Jotai has no per-store family membership; the nearest analogue is
        // building the members and dropping them from the family cache. Its
        // members are therefore created INSIDE the loop, so each iteration has
        // something for `remove` to actually remove — with them hoisted, only
        // the first iteration would do real work. It's a reference line for the
        // perf page, not an equivalent operation.
        await compare(
            "atomFamily: direct create + delete 500 members",
            () => {
                const store = valdresCreateStore()
                for (const member of vMembers) store.set(member, 1)
                for (const member of vMembers) store.del(member)
            },
            () => {
                const store = jotaiCreateStore()
                for (let i = 0; i < memberCount; i++) store.set(jFamily(i), 1)
                for (let i = 0; i < memberCount; i++) jFamily.remove(i)
            },
        )
    })
})

describe("selectorFamily", () => {
    test("create selectors from family", async () => {
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)

        const vFamily = valdresSelectorFamily<number, [number]>(
            id => get => get(vAtom) + id,
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

    test("selectorFamily string cache hit", async () => {
        const vAtom = valdresAtom(0)
        const jAtom = jotaiAtom(0)
        const vFamily = valdresSelectorFamily<number, [string]>(
            id => get => get(vAtom) + id.length,
        )
        const jFamily = jotaiAtomFamily((id: string) =>
            jotaiAtom(get => get(jAtom) + id.length),
        )

        vFamily("user-1")
        jFamily("user-1")

        await compare(
            "selectorFamily(string) cache hit",
            () => do_not_optimize(vFamily("user-1")),
            () => do_not_optimize(jFamily("user-1")),
        )
    })
})
