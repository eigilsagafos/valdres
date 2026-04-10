import { describe, test, expect } from "bun:test"
import { createRoot } from "solid-js"
import { atom, store as createStore } from "valdres"
import { createTransaction } from "./createTransaction"

describe("createTransaction", () => {
    test("runs a transaction", () => {
        const countAtom = atom(0)
        const nameAtom = atom("alice")
        const storeInstance = createStore()
        createRoot(dispose => {
            const txn = createTransaction(storeInstance)
            txn(t => {
                t.set(countAtom, 10)
                t.set(nameAtom, "bob")
            })
            expect(storeInstance.get(countAtom)).toBe(10)
            expect(storeInstance.get(nameAtom)).toBe("bob")
            dispose()
        })
    })
})
