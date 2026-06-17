import { describe, test, expect } from "bun:test"
import { atom } from "../atom"
import { store as createStore } from "../store"
import type { InitializeCallback } from "../types/InitializeCallback"
import { applyInitialize } from "./applyInitialize"

describe("applyInitialize", () => {
    test("applies returned [atom, value] pairs", () => {
        const a = atom(0)
        const b = atom(0)
        const store = createStore()
        store.txn(txn =>
            applyInitialize(txn, () => [
                [a, 1],
                [b, 2],
            ]),
        )
        expect(store.get(a)).toBe(1)
        expect(store.get(b)).toBe(2)
    })

    test("supports writing directly through txn.set (void return)", () => {
        const a = atom(0)
        const store = createStore()
        store.txn(txn =>
            applyInitialize(txn, txn => {
                txn.set(a, 5)
            }),
        )
        expect(store.get(a)).toBe(5)
    })

    test("does not throw when a single-expression callback returns the set value", () => {
        // `txn => txn.set(a, 7)` already wrote through txn.set and returns 7 (a
        // number). The Array.isArray guard must ignore it rather than try to
        // iterate it (the bug a naive `if (pairs)` guard caused).
        const a = atom(0)
        const store = createStore()
        // The type forbids this (return is `void | pair[]`), but JS callers can
        // still write it; cast to reproduce the runtime misuse.
        const sneaky = ((txn: any) => txn.set(a, 7)) as InitializeCallback
        expect(() =>
            store.txn(txn => applyInitialize(txn, sneaky)),
        ).not.toThrow()
        expect(store.get(a)).toBe(7)
    })

    test("is a no-op when initialize is undefined", () => {
        const a = atom(0)
        const store = createStore()
        expect(() =>
            store.txn(txn => applyInitialize(txn, undefined)),
        ).not.toThrow()
        expect(store.get(a)).toBe(0)
    })
})
