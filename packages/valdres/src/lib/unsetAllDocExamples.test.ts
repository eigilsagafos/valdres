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
