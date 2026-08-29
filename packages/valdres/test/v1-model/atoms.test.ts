import { describe, expect, test } from "bun:test"
import { createReferenceModel, value } from "./index"
import { atomModel, lastCommit, ok, read } from "./test-helpers"

describe("v1 reference model atoms", () => {
    test("V1M-ATOM-001 stores exact values and uses Object.is", () => {
        const model = atomModel(value.number(0))
        ok(model, {
            kind: "define-atom",
            atom: {
                id: "handler",
                fallback: {
                    kind: "eager",
                    value: value.identity("function", "fn-1"),
                },
            },
        })
        ok(model, {
            kind: "define-atom",
            atom: {
                id: "optional",
                fallback: { kind: "eager", value: value.undefined },
            },
        })
        ok(model, {
            kind: "define-atom",
            atom: {
                id: "nan",
                fallback: { kind: "eager", value: value.number(Number.NaN) },
            },
        })
        ok(model, {
            kind: "subscribe",
            tree: "tree",
            scope: "root",
            target: { kind: "atom", atom: "count" },
            subscription: "count-sub",
        })

        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: {
                kind: "set-atom",
                atom: "count",
                value: value.number(-0),
            },
        })
        expect(lastCommit(model).effectiveAtomChanges).toEqual([
            "root\u0000count",
        ])
        expect(model.trace).toContainEqual({
            kind: "notifications",
            subscriptions: ["count-sub"],
        })

        expect(read(model, "root", { kind: "atom", atom: "handler" })).toEqual({
            kind: "value",
            value: value.identity("function", "fn-1"),
        })
        expect(read(model, "root", { kind: "atom", atom: "optional" })).toEqual(
            {
                kind: "value",
                value: value.undefined,
            },
        )
        expect(read(model, "root", { kind: "atom", atom: "nan" })).toEqual({
            kind: "value",
            value: value.number(Number.NaN),
        })
        expect(
            model.execute({
                kind: "define-atom",
                atom: {
                    id: "colliding\u0000identifier",
                    fallback: { kind: "eager", value: value.number(0) },
                },
            }),
        ).toMatchObject({ ok: false, error: "INVALID_MODEL_ID" })
    })

    test("V1M-ATOM-002 resolves lazy fallbacks once per committed StoreTree", () => {
        const model = createReferenceModel()
        ok(model, {
            kind: "define-atom",
            atom: {
                id: "lazy",
                fallback: { kind: "lazy", value: value.number(7) },
            },
        })
        ok(model, { kind: "create-tree", tree: "a", root: "a-root" })
        ok(model, { kind: "create-tree", tree: "b", root: "b-root" })

        for (const [tree, scope] of [
            ["a", "a-root"],
            ["a", "a-root"],
            ["b", "b-root"],
        ] as const) {
            const result = model.execute({
                kind: "read",
                tree,
                scope,
                target: { kind: "atom", atom: "lazy" },
                as: `${tree}-read`,
            })
            expect(result).toMatchObject({ ok: true })
        }

        expect(
            model.audit.filter(
                event =>
                    event.kind === "lazy-fallback-resolved" && event.committed,
            ),
        ).toHaveLength(2)

        ok(model, {
            kind: "define-atom",
            atom: {
                id: "recoverable-lazy-error",
                fallback: { kind: "lazy-error", code: "LAZY_FAILED" },
            },
        })
        expect(
            model.execute({
                kind: "read",
                tree: "a",
                scope: "a-root",
                target: { kind: "atom", atom: "recoverable-lazy-error" },
                as: "failed-fallback",
            }),
        ).toMatchObject({ ok: false, error: "LAZY_FAILED" })
        expect(
            model.execute({
                kind: "mutate",
                tree: "a",
                scope: "a-root",
                mutation: {
                    kind: "set-atom",
                    atom: "recoverable-lazy-error",
                    value: value.number(9),
                },
            }),
        ).toMatchObject({ ok: true, committed: true })
        expect(
            model.execute({
                kind: "read",
                tree: "a",
                scope: "a-root",
                target: { kind: "atom", atom: "recoverable-lazy-error" },
                as: "recovered-value",
            }),
        ).toMatchObject({
            ok: true,
            outcome: { kind: "value", value: value.number(9) },
        })
    })

    test("V1M-ATOM-003 rejects thenables without confusing function values", () => {
        const model = atomModel()
        expect(
            model.execute({
                kind: "define-atom",
                atom: {
                    id: "eager-thenable",
                    fallback: {
                        kind: "eager",
                        value: value.identity("thenable", "promise-1"),
                    },
                },
            }),
        ).toMatchObject({ ok: false, error: "INVALID_SYNC_ATOM_VALUE" })
        ok(model, {
            kind: "define-atom",
            atom: {
                id: "lazy-thenable",
                fallback: {
                    kind: "lazy",
                    value: value.identity("thenable", "promise-2"),
                },
            },
        })
        expect(
            model.execute({
                kind: "read",
                tree: "tree",
                scope: "root",
                target: { kind: "atom", atom: "lazy-thenable" },
                as: "invalid-lazy",
            }),
        ).toMatchObject({ ok: false, error: "INVALID_LAZY_ATOM_INITIALIZER" })
        expect(
            model.execute({
                kind: "mutate",
                tree: "tree",
                scope: "root",
                mutation: {
                    kind: "set-atom",
                    atom: "count",
                    value: value.identity("thenable", "promise-3"),
                },
            }),
        ).toMatchObject({
            ok: false,
            committed: false,
            error: "INVALID_SYNC_ATOM_VALUE",
        })
        expect(read(model, "root", { kind: "atom", atom: "count" })).toEqual({
            kind: "value",
            value: value.number(0),
        })
    })
})
