import { describe, expect, test } from "bun:test"
import { atom, family } from "../../src/index"
import { createInternalStoreTreeInstrumentation } from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { v1Domain } from "../../src/v1-internal/public-domain"

const FAMILY_COUNTERS = [
    "familyOwnerRetentionSetsCreated",
    "familyOwnerRetains",
    "familyOwnerReleases",
] as const

describe("v1 family structural work", () => {
    test("constructs each member once across a high-cardinality identity set", () => {
        const counters = createInternalStoreTreeInstrumentation()
        const target = v1Domain.createStoreTree(counters)
        let factoryCalls = 0
        const members = family((id: number) => {
            factoryCalls++
            return atom(id)
        })
        const firstPass = Array.from({ length: 4_096 }, (_, id) => members(id))

        for (let id = 0; id < firstPass.length; id++) {
            expect(members(id)).toBe(firstPass[id])
        }

        expect(factoryCalls).toBe(4_096)
        expect(FAMILY_COUNTERS.map(counter => counters.read(counter))).toEqual([
            0, 0, 0,
        ])
        expect(target.get(firstPass[4_095])).toBe(4_095)
    })

    test("counts only distinct committed family Atom ownership", () => {
        const counters = createInternalStoreTreeInstrumentation()
        const root = v1Domain.createStoreTree(counters)
        const child = root.scope("child")
        const ordinary = atom(0)
        const members = family((key: string) => atom(key.length))
        const member = members("owned")

        root.set(ordinary, 1)
        root.reset(ordinary)
        root.get(members("cold"))
        expect(FAMILY_COUNTERS.map(counter => counters.read(counter))).toEqual([
            0, 0, 0,
        ])

        root.set(member, 5)
        expect(FAMILY_COUNTERS.map(counter => counters.read(counter))).toEqual([
            1, 1, 0,
        ])

        root.set(member, 5)
        expect(FAMILY_COUNTERS.map(counter => counters.read(counter))).toEqual([
            1, 1, 0,
        ])

        child.set(member, 5)
        expect(FAMILY_COUNTERS.map(counter => counters.read(counter))).toEqual([
            2, 2, 0,
        ])

        const abort = new Error("abort")
        expect(() =>
            root.txn(transaction => {
                transaction.set(members("aborted"), 99)
                throw abort
            }),
        ).toThrow(abort)
        expect(FAMILY_COUNTERS.map(counter => counters.read(counter))).toEqual([
            2, 2, 0,
        ])

        child.reset(member)
        expect(FAMILY_COUNTERS.map(counter => counters.read(counter))).toEqual([
            2, 2, 1,
        ])

        root.dispose()
        expect(FAMILY_COUNTERS.map(counter => counters.read(counter))).toEqual([
            2, 2, 2,
        ])
    })
})
