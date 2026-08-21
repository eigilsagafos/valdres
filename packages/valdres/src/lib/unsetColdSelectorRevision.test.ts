import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

/**
 * A COLD selector — one with no subscriber and no live dependent — is not
 * recomputed by propagation. It keeps a cached value plus a snapshot of its
 * dependencies' revisions, and the next read revalidates against those.
 *
 * Dropping a scope's own value for a dependency has to invalidate that snapshot
 * like any other change. It is the one write that REMOVES the local value
 * rather than replacing it, so the revision it bumps has to be one a later read
 * will actually consult — and after the removal, reads resolve through the
 * parent.
 */

describe("unset invalidates a scope's cold selector caches", () => {
    test("store.unset — a cold selector re-reads the inherited value", () => {
        const source = atom("root")
        const derived = selector(get => `d:${get(source)}`)
        const root = store()
        const draft = root.scope("draft")

        draft.set(source, "draft")
        expect(draft.get(derived)).toBe("d:draft")

        draft.unset(source)

        expect(draft.get(derived)).toBe("d:root")
    })

    test("txn.unset — same, through the transaction path", () => {
        const source = atom("root")
        const derived = selector(get => `d:${get(source)}`)
        const root = store()
        const draft = root.scope("draft")

        draft.set(source, "draft")
        expect(draft.get(derived)).toBe("d:draft")

        draft.txn(txn => txn.unset(source))

        expect(draft.get(derived)).toBe("d:root")
    })

    test("scope.unsetAll — every cold selector in the scope, not just one", () => {
        const first = atom("root-first")
        const second = atom("root-second")
        const firstDerived = selector(get => `1:${get(first)}`)
        const secondDerived = selector(get => `2:${get(second)}`)
        const root = store()
        const draft = root.scope("draft")

        draft.set(first, "draft-first")
        draft.set(second, "draft-second")
        expect(draft.get(firstDerived)).toBe("1:draft-first")
        expect(draft.get(secondDerived)).toBe("2:draft-second")

        draft.unsetAll()

        expect(draft.get(firstDerived)).toBe("1:root-first")
        expect(draft.get(secondDerived)).toBe("2:root-second")
    })

    test("a LIVE selector was never affected — pins the boundary", () => {
        const source = atom("root")
        const derived = selector(get => `d:${get(source)}`)
        const root = store()
        const draft = root.scope("draft")
        const unsubscribe = draft.sub(derived, () => {})

        draft.set(source, "draft")
        expect(draft.get(derived)).toBe("d:draft")

        draft.unset(source)

        expect(draft.get(derived)).toBe("d:root")
        unsubscribe()
    })

    test("a root store's cold selector was never affected — pins the boundary", () => {
        const source = atom("start")
        const derived = selector(get => `d:${get(source)}`)
        const root = store()

        root.set(source, "changed")
        expect(root.get(derived)).toBe("d:changed")

        root.unset(source)

        expect(root.get(derived)).toBe("d:start")
    })

    test("the parent keeps moving under a reverted scope's cold selector", () => {
        const source = atom("root")
        const derived = selector(get => `d:${get(source)}`)
        const root = store()
        const draft = root.scope("draft")

        draft.set(source, "draft")
        expect(draft.get(derived)).toBe("d:draft")
        draft.unset(source)
        expect(draft.get(derived)).toBe("d:root")

        // The scope tracks the parent again, so a later parent write must also
        // invalidate the (still cold) cache.
        root.set(source, "root 2")
        expect(draft.get(derived)).toBe("d:root 2")
    })
})
