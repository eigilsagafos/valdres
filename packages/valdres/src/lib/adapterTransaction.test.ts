import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { Transaction } from "../adapter-internals"
import { store } from "../store"

describe("adapter transaction lifecycle", () => {
    test("commit is terminal", () => {
        const store1 = store()
        const atom1 = atom(1)
        const txn = new Transaction(store1.data)

        txn.set(atom1, 2)
        txn.commit()

        expect(store1.get(atom1)).toBe(2)
        expect(() => txn.commit()).toThrow(
            "Cannot commit transaction while it is closed",
        )
        expect(() => txn.set(atom1, 3)).toThrow(
            "Cannot write to transaction while it is closed",
        )
    })

    test("abort discards staged writes and is terminal", () => {
        const store1 = store()
        const atom1 = atom(1)
        const txn = new Transaction(store1.data)

        txn.set(atom1, 2)
        txn.abort()

        expect(store1.get(atom1)).toBe(1)
        expect(() => txn.abort()).toThrow(
            "Cannot abort transaction while it is closed",
        )
        expect(() => txn.get(atom1)).toThrow(
            "Cannot read from transaction while it is closed",
        )
    })

    test("every callback operation rejects use after close", () => {
        const store1 = store()
        store1.scope("child")
        const atom1 = atom(1)
        const family = atomFamily(0)
        const member = family("member")
        const txn = new Transaction(store1.data)
        txn.commit()

        const operations = [
            () => txn.get(atom1),
            () => txn.set(atom1, 2),
            () => txn.del(member),
            () => txn.reset(atom1),
            () => txn.unset(atom1),
            () => txn.batchSetFamilyAtoms(family, []),
            () => txn.scope("child", () => {}),
            () => txn.parentScope(() => {}),
        ]

        for (const operation of operations) {
            expect(operation).toThrow("transaction while it is closed")
        }
    })

    test("commit preserves an adapter-supplied change source", () => {
        const store1 = store()
        const atom1 = atom(1)
        const sources: string[] = []
        const unsubscribe = store1.onChange((_changes, meta) =>
            sources.push(meta.source),
        )
        const txn = new Transaction(store1.data)

        txn.set(atom1, 2)
        txn.commit("reset")

        expect(sources).toEqual(["reset"])
        unsubscribe()
    })
})
