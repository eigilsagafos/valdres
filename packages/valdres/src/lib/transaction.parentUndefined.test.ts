import { describe, test, expect } from "bun:test"
import { atom } from "../atom"
import { store } from "../store"

describe("Transaction.get with undefined values in parent transaction", () => {
    test("txn.get reads undefined set in parent scope transaction", () => {
        const myAtom = atom<string | undefined>("initial")
        const s = store()
        s.scope("child")

        s.txn(({ set, get }) => {
            set(myAtom, undefined)
            expect(get(myAtom)).toBe(undefined)
        })

        expect(s.get(myAtom)).toBe(undefined)
    })

    test("nested txn reads undefined from parent txn via scope", () => {
        const myAtom = atom<number | undefined>(42)
        const s = store()
        s.scope("child")

        s.txn(txn => {
            txn.set(myAtom, undefined)
            txn.scope("child", childTxn => {
                expect(childTxn.get(myAtom)).toBe(undefined)
            })
        })
    })
})
