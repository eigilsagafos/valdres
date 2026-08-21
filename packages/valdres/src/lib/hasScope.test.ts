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

    test("checked INSIDE a batched transaction, past the pending-batch flush", () => {
        // `store.txn` on a batchUpdates store flushes the pending batch before
        // running the callback, and a subscriber woken by that flush can detach
        // the last lease on a scope. A guard placed before `txn` is therefore
        // checking a fact the flush can invalidate; inside the callback the
        // flush has already happened and nothing else can destroy a scope until
        // the body returns.
        const trigger = atom("start")
        const root = store({ batchUpdates: true })
        const draft = root.scope("draft")
        root.sub(trigger, () => draft.detach())

        root.set(trigger, "fires")
        expect(root.hasScope("draft")).toBe(true)

        expect(() =>
            root.txn(txn => {
                if (root.hasScope("draft")) {
                    txn.scope("draft", scoped => scoped.unsetAll())
                }
            }),
        ).not.toThrow()

        expect(root.hasScope("draft")).toBe(false)
    })

    test("throws on a disposed store", () => {
        const root = store()
        root.dispose()
        expect(() => root.hasScope("draft")).toThrow(/disposed/i)
    })
})
