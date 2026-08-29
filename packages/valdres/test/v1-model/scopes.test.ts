import { describe, expect, test } from "bun:test"
import { value } from "./index"
import { atomModel, lastCommit, ok, readNumber } from "./test-helpers"

describe("v1 reference model scopes", () => {
    test("V1M-SCOPE-001 keeps inheritance live and reset symbolic", () => {
        const model = atomModel()
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope: "child",
        })
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: {
                kind: "set-atom",
                atom: "count",
                value: value.number(1),
            },
        })
        expect(readNumber(model, "child")).toBe(1)

        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "child",
            mutation: {
                kind: "set-atom",
                atom: "count",
                value: value.number(1),
            },
        })
        expect(lastCommit(model).ownershipChanges).toEqual([
            "child\u0000atom\u0000count",
        ])
        expect(lastCommit(model).effectiveAtomChanges).toEqual([])

        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: {
                kind: "set-atom",
                atom: "count",
                value: value.number(2),
            },
        })
        expect(readNumber(model, "child")).toBe(1)
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "child",
            mutation: { kind: "reset-atom", atom: "count" },
        })
        expect(readNumber(model, "child")).toBe(2)
    })

    test("V1M-SCOPE-002 keeps names parent-local and anonymous identities fresh", () => {
        const model = atomModel()
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope: "left",
            name: "left",
        })
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope: "left",
            name: "left",
        })
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope: "anon-1",
        })
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope: "anon-2",
        })
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "left",
            scope: "nested-left",
            name: "shared",
        })
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "anon-1",
            scope: "nested-anon",
            name: "shared",
        })

        expect(
            model.audit
                .filter(event => event.kind === "scope-created")
                .map(event => event.scope),
        ).toEqual([
            "root",
            "left",
            "anon-1",
            "anon-2",
            "nested-left",
            "nested-anon",
        ])
    })

    test("V1M-SCOPE-003 disposes postorder and recreation is a new generation", () => {
        const model = atomModel()
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope: "draft-1",
            name: "draft",
        })
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "draft-1",
            scope: "grandchild",
        })
        ok(model, { kind: "dispose", tree: "tree", scope: "draft-1" })
        expect(model.trace.at(-1)).toEqual({
            kind: "disposed",
            scopes: ["grandchild", "draft-1"],
        })
        expect(
            model.execute({
                kind: "read",
                tree: "tree",
                scope: "draft-1",
                target: { kind: "atom", atom: "count" },
                as: "stale",
            }),
        ).toMatchObject({ ok: false, error: "STORE_DISPOSED" })
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope: "draft-2",
            name: "draft",
        })
        expect(readNumber(model, "draft-2")).toBe(0)
    })
})
