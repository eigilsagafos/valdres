import { describe, expect, test } from "bun:test"
import { value } from "./index"
import {
    collectionModel,
    lastCommit,
    ok,
    read,
    rowValue,
    rows,
} from "./test-helpers"

describe("v1 reference model collections", () => {
    test("V1M-COLLECTION-001 keeps row definition inert and absence explicit", () => {
        const model = collectionModel()
        expect(model.audit.filter(event => event.kind === "commit")).toEqual([])
        expect(rowValue(model, "root", "a")).toBeUndefined()
        expect(read(model, "root", { kind: "presence", row: "a" })).toEqual({
            kind: "presence",
            value: false,
        })
        expect(rows(model, "root").rows).toEqual([])

        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: { kind: "set-row", row: "a", value: value.string("A") },
        })
        expect(rowValue(model, "root", "a")).toEqual(value.string("A"))
        expect(read(model, "root", { kind: "presence", row: "a" })).toEqual({
            kind: "presence",
            value: true,
        })
        expect(rows(model, "root").rows).toEqual(["a"])

        const firstZero = model.execute({
            kind: "define-row",
            collection: "movies",
            row: "negative-zero",
            key: -0,
        })
        expect(firstZero).toMatchObject({
            ok: true,
            row: "negative-zero",
            key: 0,
        })
        expect(
            model.execute({
                kind: "define-row",
                collection: "movies",
                row: "positive-zero",
                key: 0,
            }),
        ).toMatchObject({ ok: true, row: "negative-zero", key: 0 })
    })

    test("V1M-COLLECTION-002 preserves membership snapshots for value-only changes", () => {
        const model = collectionModel()
        for (const [row, label] of [
            ["a", "A"],
            ["b", "B"],
        ] as const) {
            ok(model, {
                kind: "mutate",
                tree: "tree",
                scope: "root",
                mutation: { kind: "set-row", row, value: value.string(label) },
            })
        }
        const before = rows(model, "root")
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: {
                kind: "update-row",
                row: "a",
                updater: { kind: "replace", value: value.string("A2") },
            },
        })
        const after = rows(model, "root")
        expect(after.rows).toEqual(["a", "b"])
        expect(after.snapshot).toBe(before.snapshot)
        expect(lastCommit(model).collectionDeltas).toMatchObject([
            { row: "a", membership: "unchanged" },
        ])
    })

    test("V1M-COLLECTION-003 uses effective insertion order across commits and a flat draft", () => {
        const model = collectionModel()
        ok(model, {
            kind: "transact",
            tree: "tree",
            entryScope: "root",
            steps: [
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-row",
                        row: "b",
                        value: value.string("B"),
                    },
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-row",
                        row: "a",
                        value: value.string("A"),
                    },
                },
                {
                    kind: "read",
                    cursor: "entry",
                    target: { kind: "collection", collection: "movies" },
                    as: "draft-order",
                },
            ],
        })
        expect(model.trace).toContainEqual({
            kind: "read",
            as: "draft-order",
            outcome: {
                kind: "rows",
                rows: ["b", "a"],
                snapshot: "draft:1:1",
            },
        })
        expect(rows(model, "root").rows).toEqual(["b", "a"])

        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: { kind: "delete-row", row: "b" },
        })
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: { kind: "set-row", row: "b", value: value.string("B2") },
        })
        expect(rows(model, "root").rows).toEqual(["a", "b"])
    })

    test("V1M-COLLECTION-004 tombstones shield inheritance and reset reconnects it", () => {
        const model = collectionModel()
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: {
                kind: "set-row",
                row: "a",
                value: value.string("root-1"),
            },
        })
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope: "child",
        })
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "child",
            mutation: { kind: "delete-row", row: "a" },
        })
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: {
                kind: "set-row",
                row: "a",
                value: value.string("root-2"),
            },
        })
        expect(rowValue(model, "child", "a")).toBeUndefined()
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "child",
            mutation: { kind: "reset-row", row: "a" },
        })
        expect(rowValue(model, "child", "a")).toEqual(value.string("root-2"))

        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "child",
            mutation: {
                kind: "update-row",
                row: "a",
                updater: { kind: "replace", value: value.string("child") },
            },
        })
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: {
                kind: "set-row",
                row: "a",
                value: value.string("root-3"),
            },
        })
        expect(rowValue(model, "child", "a")).toEqual(value.string("child"))
    })

    test("V1M-COLLECTION-005 rejects undefined and absent update before staging", () => {
        const model = collectionModel()
        model.clearEvents()
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: { kind: "delete-row", row: "a" },
        })
        expect(model.audit).toEqual([])
        expect(
            model.execute({
                kind: "mutate",
                tree: "tree",
                scope: "root",
                mutation: { kind: "set-row", row: "a", value: value.undefined },
            }),
        ).toMatchObject({
            ok: false,
            committed: false,
            error: "UNDEFINED_COLLECTION_VALUE",
        })
        expect(
            model.execute({
                kind: "mutate",
                tree: "tree",
                scope: "root",
                mutation: {
                    kind: "set-row",
                    row: "a",
                    value: value.identity("thenable", "row-promise"),
                },
            }),
        ).toMatchObject({
            ok: false,
            committed: false,
            error: "INVALID_SYNC_COLLECTION_VALUE",
        })
        expect(
            model.execute({
                kind: "mutate",
                tree: "tree",
                scope: "root",
                mutation: {
                    kind: "update-row",
                    row: "a",
                    updater: { kind: "fail", code: "MUST_NOT_RUN" },
                },
            }),
        ).toMatchObject({
            ok: false,
            committed: false,
            error: "MISSING_COLLECTION_ROW",
        })
        expect(rows(model, "root").rows).toEqual([])

        ok(model, {
            kind: "transact",
            tree: "tree",
            entryScope: "root",
            steps: [
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-row",
                        row: "a",
                        value: value.string("A"),
                    },
                },
                {
                    kind: "attempt",
                    steps: [
                        {
                            kind: "mutate",
                            cursor: "entry",
                            mutation: {
                                kind: "set-row",
                                row: "b",
                                value: value.undefined,
                            },
                        },
                    ],
                },
            ],
        })
        expect(rows(model, "root").rows).toEqual(["a"])
    })

    test("V1M-COLLECTION-006 orders inherited births by the latest enabling intent", () => {
        for (const order of ["reset-first", "root-first"] as const) {
            const model = collectionModel()
            ok(model, {
                kind: "create-scope",
                tree: "tree",
                parent: "root",
                scope: "child",
            })
            ok(model, {
                kind: "mutate",
                tree: "tree",
                scope: "child",
                mutation: { kind: "delete-row", row: "a" },
            })
            const reset = {
                kind: "mutate" as const,
                cursor: "child",
                mutation: { kind: "reset-row" as const, row: "a" },
            }
            const rootSet = {
                kind: "mutate" as const,
                cursor: "entry",
                mutation: {
                    kind: "set-row" as const,
                    row: "a",
                    value: value.string("A"),
                },
            }
            ok(model, {
                kind: "transact",
                tree: "tree",
                entryScope: "root",
                steps: [
                    {
                        kind: "resolve-cursor",
                        cursor: "child",
                        target: {
                            kind: "scope",
                            tree: "tree",
                            scope: "child",
                        },
                    },
                    ...(order === "reset-first"
                        ? [reset, rootSet]
                        : [rootSet, reset]),
                ],
            })
            const childDelta = lastCommit(model).collectionDeltas.find(
                delta => delta.scope === "child" && delta.row === "a",
            )
            expect(childDelta).toMatchObject({
                membership: "insert",
                birthSequence: 2,
            })
            expect(rows(model, "child").rows).toEqual(["a"])
        }
    })

    test("V1M-COLLECTION-007 emits effective deltas but no routing-only delta", () => {
        const model = collectionModel()
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: { kind: "set-row", row: "a", value: value.string("A") },
        })
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
            mutation: { kind: "set-row", row: "a", value: value.string("A2") },
        })
        expect(
            lastCommit(model).collectionDeltas.map(delta => delta.scope),
        ).toEqual(["root", "child"])

        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "child",
            mutation: { kind: "set-row", row: "a", value: value.string("A2") },
        })
        expect(lastCommit(model).ownershipChanges).toEqual([
            "child\u0000row\u0000a",
        ])
        expect(lastCommit(model).collectionDeltas).toEqual([])
    })

    test("V1M-COLLECTION-008 ignores no-op resets when ordering draft births", () => {
        const model = collectionModel()
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope: "child",
        })
        ok(model, {
            kind: "transact",
            tree: "tree",
            entryScope: "root",
            steps: [
                {
                    kind: "resolve-cursor",
                    cursor: "child",
                    target: {
                        kind: "scope",
                        tree: "tree",
                        scope: "child",
                    },
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-row",
                        row: "a",
                        value: value.string("A"),
                    },
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-row",
                        row: "b",
                        value: value.string("B"),
                    },
                },
                {
                    kind: "mutate",
                    cursor: "child",
                    mutation: { kind: "reset-row", row: "a" },
                },
                {
                    kind: "read",
                    cursor: "child",
                    target: { kind: "collection", collection: "movies" },
                    as: "no-op-reset-order",
                },
            ],
        })
        expect(model.trace).toContainEqual({
            kind: "read",
            as: "no-op-reset-order",
            outcome: {
                kind: "rows",
                rows: ["a", "b"],
                snapshot: "draft:1:1",
            },
        })
        expect(rows(model, "child").rows).toEqual(["a", "b"])
    })

    test("V1M-COLLECTION-009 keeps draft membership identity stable and private", () => {
        const model = collectionModel()
        ok(model, {
            kind: "define-collection",
            collection: { id: "unrelated" },
        })
        ok(model, {
            kind: "define-atom",
            atom: {
                id: "unrelated-atom",
                fallback: { kind: "eager", value: value.number(0) },
            },
        })
        model.clearEvents()
        ok(model, {
            kind: "transact",
            tree: "tree",
            entryScope: "root",
            steps: [
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-row",
                        row: "a",
                        value: value.string("A"),
                    },
                },
                {
                    kind: "read",
                    cursor: "entry",
                    target: { kind: "collection", collection: "movies" },
                    as: "before-unrelated-write",
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-atom",
                        atom: "unrelated-atom",
                        value: value.number(1),
                    },
                },
                {
                    kind: "read",
                    cursor: "entry",
                    target: { kind: "collection", collection: "movies" },
                    as: "after-unrelated-write",
                },
            ],
        })
        const draftReads = model.trace.filter(
            event =>
                event.kind === "read" &&
                (event.as === "before-unrelated-write" ||
                    event.as === "after-unrelated-write"),
        )
        expect(draftReads).toHaveLength(2)
        expect(draftReads[0]).toEqual({
            kind: "read",
            as: "before-unrelated-write",
            outcome: {
                kind: "rows",
                rows: ["a"],
                snapshot: "draft:1:1",
            },
        })
        expect(draftReads[1]).toEqual({
            kind: "read",
            as: "after-unrelated-write",
            outcome: {
                kind: "rows",
                rows: ["a"],
                snapshot: "draft:1:1",
            },
        })

        model.clearEvents()
        ok(model, {
            kind: "transact",
            tree: "tree",
            entryScope: "root",
            steps: [
                {
                    kind: "read",
                    cursor: "entry",
                    target: { kind: "collection", collection: "unrelated" },
                    as: "private-empty-membership",
                },
            ],
        })
        expect(model.audit).toEqual([])
        expect(
            read(model, "root", {
                kind: "collection",
                collection: "unrelated",
            }),
        ).toEqual({ kind: "rows", rows: [], snapshot: 2 })

        const aborted = collectionModel()
        const snapshots: Array<number | string> = []
        for (const label of ["first", "second"] as const) {
            aborted.clearEvents()
            expect(
                aborted.execute({
                    kind: "transact",
                    tree: "tree",
                    entryScope: "root",
                    steps: [
                        {
                            kind: "mutate",
                            cursor: "entry",
                            mutation: {
                                kind: "set-row",
                                row: "a",
                                value: value.string(label),
                            },
                        },
                        {
                            kind: "read",
                            cursor: "entry",
                            target: {
                                kind: "collection",
                                collection: "movies",
                            },
                            as: `${label}-aborted-membership`,
                        },
                        { kind: "raise", code: "ABORT" },
                    ],
                }),
            ).toMatchObject({ ok: false, committed: false, error: "ABORT" })
            const outcome = aborted.trace.find(
                event => event.kind === "read",
            )?.outcome
            expect(outcome?.kind).toBe("rows")
            snapshots.push(
                (outcome as Extract<typeof outcome, { kind: "rows" }>).snapshot,
            )
        }
        expect(snapshots[0]).not.toBe(snapshots[1])
        expect(rows(aborted, "root").rows).toEqual([])

        const encoded = collectionModel()
        for (const collection of ["c", "b:c"] as const) {
            ok(encoded, {
                kind: "define-collection",
                collection: { id: collection },
            })
        }
        for (const scope of ["a:b", "a"] as const) {
            ok(encoded, {
                kind: "create-scope",
                tree: "tree",
                parent: "root",
                scope,
            })
        }
        const encodedSnapshots: Array<number | string> = []
        for (const [scope, collection] of [
            ["a:b", "c"],
            ["a", "b:c"],
        ] as const) {
            encoded.clearEvents()
            ok(encoded, {
                kind: "transact",
                tree: "tree",
                entryScope: scope,
                steps: [
                    {
                        kind: "read",
                        cursor: "entry",
                        target: { kind: "collection", collection },
                        as: "encoded-baseline",
                    },
                ],
            })
            const outcome = encoded.trace.find(
                event => event.kind === "read",
            )?.outcome
            expect(outcome?.kind).toBe("rows")
            encodedSnapshots.push(
                (outcome as Extract<typeof outcome, { kind: "rows" }>).snapshot,
            )
        }
        expect(encodedSnapshots[0]).not.toBe(encodedSnapshots[1])
    })
})
