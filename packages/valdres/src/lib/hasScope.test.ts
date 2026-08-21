import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { store } from "../store"

/**
 * `store.hasScope` answers a plain structural question that was already public,
 * just only reachable by catching the exception `scope(id, callback)` throws for
 * a scope that does not exist.
 */

describe("store.hasScope", () => {
    test("reports whether a child scope exists", () => {
        const root = store()
        expect(root.hasScope("draft")).toBe(false)

        const draft = root.scope("draft")
        expect(root.hasScope("draft")).toBe(true)
        expect(root.hasScope("other")).toBe(false)

        draft.detach()
        expect(root.hasScope("draft")).toBe(false)
    })

    test("only its OWN children — it does not search the tree", () => {
        const root = store()
        const draft = root.scope("draft")
        const nested = draft.scope("nested")

        expect(root.hasScope("nested")).toBe(false)
        expect(draft.hasScope("nested")).toBe(true)
        // Depth composes through `scope()` instead of a path argument.
        expect(root.scope("draft", s => s.hasScope("nested"))).toBe(true)

        nested.detach()
        draft.detach()
    })

    test("guards the throwing forms without catching", () => {
        const title = atom("root")
        const root = store()
        root.scope("live").set(title, "draft")

        // The shape a consumer needs when a scope may never have been opened.
        for (const ref of ["live", "never-opened"]) {
            if (root.hasScope(ref)) {
                root.txn(txn => txn.scope(ref, scoped => scoped.unsetAll()))
            }
        }

        expect(root.scope("live", s => s.get(title))).toBe("root")
        expect(root.hasScope("never-opened")).toBe(false)
    })

    test("survives a scope being reused after its lease is released", () => {
        const root = store()
        root.scope("draft").detach()
        expect(root.hasScope("draft")).toBe(false)
        const again = root.scope("draft")
        expect(root.hasScope("draft")).toBe(true)
        again.detach()
    })

    test("throws on a disposed store", () => {
        const root = store()
        root.dispose()
        expect(() => root.hasScope("draft")).toThrow(/disposed/i)
    })
})
