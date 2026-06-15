import { describe, expect, mock, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import type { Atom } from "../types/Atom"
import type { InitializeCallback } from "../types/InitializeCallback"
import { store } from "../store"
import { setAtomPairs } from "./setAtomPairs"

describe("setAtomPairs", () => {
    test("applies an InitializeCallback's returned pairs through txn.set in one commit", () => {
        const a = atom(0)
        const b = atom("")
        const fam = atomFamily<number, [string]>(0)

        // Typed against TransactionInterface and passed straight to store.txn —
        // the adapter wiring this replaces needed a @ts-ignore for exactly this.
        const initialize: InitializeCallback = txn => {
            txn.set(fam("direct"), 7)
            return [
                [a, 1],
                [b, "two"],
            ] as [Atom<any>, any][]
        }

        const store1 = store()
        const onChange = mock(() => {})
        const unsub = store1.onChange(onChange)
        store1.txn(txn => {
            const pairs = initialize(txn)
            if (pairs) setAtomPairs(txn.set, pairs)
        })
        unsub()

        expect(store1.get(a)).toBe(1)
        expect(store1.get(b)).toBe("two")
        expect(store1.get(fam("direct"))).toBe(7)
        expect(onChange).toHaveBeenCalledTimes(1) // one transaction commit
    })

    test("works with a void InitializeCallback (nothing to apply)", () => {
        const a = atom(0)
        const initialize: InitializeCallback = txn => {
            txn.set(a, 5)
        }
        const store1 = store()
        store1.txn(txn => {
            const pairs = initialize(txn)
            if (pairs) setAtomPairs(txn.set, pairs)
        })
        expect(store1.get(a)).toBe(5)
    })

    test("also accepts a plain function updater pair value", () => {
        const a = atom(10)
        const store1 = store()
        store1.txn(txn => {
            setAtomPairs(txn.set, [[a, (current: number) => current + 5]])
        })
        expect(store1.get(a)).toBe(15)
    })
})
