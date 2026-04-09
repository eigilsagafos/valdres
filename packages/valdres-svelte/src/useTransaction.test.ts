import { describe, test, expect } from "bun:test"
import { atom, store } from "valdres"
import { useTransaction } from "./useTransaction"

describe("useTransaction", () => {
    test("returns a transaction function", () => {
        const s = store()
        const txn = useTransaction(s)

        expect(typeof txn).toBe("function")
    })

    test("transaction can set multiple atoms atomically", () => {
        const aAtom = atom(0)
        const bAtom = atom(0)
        const s = store()
        const txn = useTransaction(s)

        txn(({ set }) => {
            set(aAtom, 1)
            set(bAtom, 2)
        })

        expect(s.get(aAtom)).toBe(1)
        expect(s.get(bAtom)).toBe(2)
    })

    test("transaction can read and write atoms", () => {
        const countAtom = atom(5)
        const s = store()
        const txn = useTransaction(s)

        txn(({ get, set }) => {
            const current = get(countAtom)
            set(countAtom, current * 2)
        })

        expect(s.get(countAtom)).toBe(10)
    })
})
