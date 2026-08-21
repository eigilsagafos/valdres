import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { store } from "../store"

/**
 * `store.txn` has always returned its callback's value at runtime; it was just
 * typed `void`, so consumers cast. The two other callback forms —
 * `store.scope(id, cb)` and `txn.scope(id, cb)` — are both typed
 * `=> ReturnType<Callback>`, so this is the odd one out rather than a decision.
 */

describe("store.txn returns its callback's value", () => {
    test("a value read inside the transaction comes back out", () => {
        const count = atom(1)
        const root = store()

        const doubled = root.txn(txn => {
            txn.set(count, 21)
            return txn.get(count) * 2
        })

        expect(doubled).toBe(42)
        expect(root.get(count)).toBe(21)
        // The TYPE of the return value is pinned in
        // publicTypeSurface.types.test.ts — only that lane is typechecked.
    })

    test("undefined stays undefined for a callback that returns nothing", () => {
        const count = atom(0)
        const root = store()
        const result = root.txn(txn => {
            txn.set(count, 1)
        })
        expect(result).toBeUndefined()
    })

    test("a scoped store's transaction returns too", () => {
        const count = atom(1)
        const root = store()
        const draft = root.scope("draft")

        const seen = draft.txn(txn => {
            txn.set(count, 7)
            return txn.get(count)
        })

        expect(seen).toBe(7)
        draft.detach()
    })

    test("nothing comes back from a transaction that threw", () => {
        const count = atom(1)
        const root = store()
        expect(() =>
            root.txn(() => {
                throw new Error("nope")
            }),
        ).toThrow("nope")
        expect(root.get(count)).toBe(1)
    })
})
