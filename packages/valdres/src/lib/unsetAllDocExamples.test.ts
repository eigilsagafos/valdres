import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { store } from "../store"

/**
 * The "Reverting a scope" examples from docs/content/guides/scoped-stores.mdx,
 * run as written. A guide that rebinds `root`/`child` across sections is very
 * easy to break by editing one block, and a reader copying a snippet that
 * throws is worse than no snippet — so the snippets are self-contained there
 * and executed here.
 */

describe("docs: reverting a scope", () => {
    test("unset drops one shadowed value", () => {
        const nameAtom = atom("Alice")
        const todoAtom = atomFamily<string, [string]>(id => `todo:${id}`)

        const root = store()
        root.set(todoAtom("a"), "Buy milk")
        const draft = root.scope("draft")

        draft.set(nameAtom, "Bob")
        draft.unset(nameAtom)
        expect(draft.get(nameAtom)).toBe("Alice")
    })

    test("unsetAll drops everything the scope owns", () => {
        const nameAtom = atom("Alice")
        const todoAtom = atomFamily<string, [string]>(id => `todo:${id}`)

        const root = store()
        root.set(todoAtom("a"), "Buy milk")
        const draft = root.scope("draft")

        draft.set(nameAtom, "Bob")
        draft.set(todoAtom("b"), "Draft todo")

        draft.unsetAll()

        expect(draft.get(nameAtom)).toBe("Alice")
        expect(draft.get(todoAtom)).toStrictEqual([todoAtom("a")])
    })

    test("a scope's own transaction reverts it directly", () => {
        const nameAtom = atom("Alice")
        const root = store()
        const draft = root.scope("draft")
        draft.set(nameAtom, "Bob")

        draft.txn(txn => {
            txn.unsetAll()
            txn.set(nameAtom, "a fresh start")
        })

        expect(draft.get(nameAtom)).toBe("a fresh start")
        expect(root.get(nameAtom)).toBe("Alice")
    })

    test("the parent drives the revert as part of publishing", () => {
        const nameAtom = atom("Alice")
        const publishedName = atom("")
        const root = store()
        const draft = root.scope("draft")
        draft.set(nameAtom, "Bob")

        root.txn(txn => {
            txn.set(
                publishedName,
                root.scope("draft", s => s.get(nameAtom)),
            )
            txn.scope("draft", scoped => scoped.unsetAll())
        })

        expect(root.get(publishedName)).toBe("Bob")
        expect(draft.get(nameAtom)).toBe("Alice")
    })

    test("txn.scope throws for a scope that was never opened", () => {
        const root = store()
        expect(() =>
            root.txn(txn => txn.scope("never-opened", s => s.unsetAll())),
        ).toThrow(/scope 'never-opened' not found/)
    })
})

describe("docs: deleting a member in a scope", () => {
    test("the two read paths disagree, on purpose", () => {
        const todoAtom = atomFamily<string, [string]>(id => `todo:${id}`)
        const root = store()
        const child = root.scope("draft")

        root.set(todoAtom("a"), "Buy milk")

        child.del(todoAtom("a"))

        expect(child.get(todoAtom)).toStrictEqual([])
        expect(child.get(todoAtom("a"))).toBe("Buy milk")
        expect(root.get(todoAtom)).toStrictEqual([todoAtom("a")])
    })

    test("a root delete has nothing to fall through to", () => {
        const todoAtom = atomFamily<string, [string]>(id => `todo:${id}`)
        const root = store()
        root.set(todoAtom("a"), "Buy milk")

        root.del(todoAtom("a"))

        expect(root.get(todoAtom)).toStrictEqual([])
        expect(root.get(todoAtom("a"))).toBe("todo:a")
    })
})

describe("docs: cleanup", () => {
    test("hasScope reports whether the scope outlived your lease", () => {
        const root = store()
        const first = root.scope("draft")
        const second = root.scope("draft")

        first.detach()
        expect(root.hasScope("draft")).toBe(true)
        second.detach()
        expect(root.hasScope("draft")).toBe(false)
    })

    test("onDispose releases what you keep alongside a scope", () => {
        const cache = new Map<string, string>()
        const root = store()
        const changeSetRef = "cs-1"

        const draft = root.scope(changeSetRef)
        cache.set(changeSetRef, "scratch")
        draft.onDispose(() => cache.delete(changeSetRef))

        draft.detach()
        expect(cache.has(changeSetRef)).toBe(false)
    })

    test("guarding txn.scope with hasScope", () => {
        const nameAtom = atom("Alice")
        const root = store()
        root.scope("draft").set(nameAtom, "Bob")

        for (const ref of ["draft", "never-opened"]) {
            if (root.hasScope(ref)) {
                root.txn(txn => txn.scope(ref, scoped => scoped.unsetAll()))
            }
        }

        expect(root.scope("draft", s => s.get(nameAtom))).toBe("Alice")
    })
})
