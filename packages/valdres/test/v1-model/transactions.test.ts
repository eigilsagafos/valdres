import { describe, expect, test } from "bun:test"
import { value } from "./index"
import { atomModel, ok, readNumber } from "./test-helpers"

describe("v1 reference model transactions", () => {
    test("V1M-TXN-001 resolves root, child, and sibling writes from one final overlay", () => {
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
            scope: "right",
            name: "right",
        })
        ok(model, {
            kind: "subscribe",
            tree: "tree",
            scope: "root",
            target: { kind: "atom", atom: "count" },
            subscription: "root-observer",
            observe: [
                {
                    scope: "root",
                    target: { kind: "atom", atom: "count" },
                    as: "root",
                },
                {
                    scope: "left",
                    target: { kind: "atom", atom: "count" },
                    as: "left",
                },
                {
                    scope: "right",
                    target: { kind: "atom", atom: "count" },
                    as: "right",
                },
            ],
        })
        model.clearEvents()

        ok(model, {
            kind: "transact",
            tree: "tree",
            entryScope: "root",
            steps: [
                {
                    kind: "resolve-cursor",
                    cursor: "left",
                    target: {
                        kind: "child-name",
                        parentCursor: "entry",
                        name: "left",
                    },
                },
                {
                    kind: "resolve-cursor",
                    cursor: "right",
                    target: { kind: "scope", tree: "tree", scope: "right" },
                },
                {
                    kind: "mutate",
                    cursor: "left",
                    mutation: { kind: "reset-atom", atom: "count" },
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-atom",
                        atom: "count",
                        value: value.number(4),
                    },
                },
                {
                    kind: "mutate",
                    cursor: "right",
                    mutation: {
                        kind: "set-atom",
                        atom: "count",
                        value: value.number(9),
                    },
                },
                {
                    kind: "read",
                    cursor: "left",
                    target: { kind: "atom", atom: "count" },
                    as: "left",
                },
                {
                    kind: "read",
                    cursor: "right",
                    target: { kind: "atom", atom: "count" },
                    as: "right",
                },
            ],
        })

        expect(model.trace).toContainEqual({
            kind: "read",
            as: "left",
            outcome: { kind: "value", value: value.number(4) },
        })
        expect(model.trace).toContainEqual({
            kind: "read",
            as: "right",
            outcome: { kind: "value", value: value.number(9) },
        })
        expect(model.trace).toContainEqual({
            kind: "notification-observation",
            subscription: "root-observer",
            reads: [
                {
                    as: "root",
                    outcome: { kind: "value", value: value.number(4) },
                },
                {
                    as: "left",
                    outcome: { kind: "value", value: value.number(4) },
                },
                {
                    as: "right",
                    outcome: { kind: "value", value: value.number(9) },
                },
            ],
        })
        expect(readNumber(model, "root")).toBe(4)
        expect(readNumber(model, "left")).toBe(4)
        expect(readNumber(model, "right")).toBe(9)
    })

    test("V1M-TXN-002 scope cursors share one draft and caught errors are not savepoints", () => {
        const model = atomModel()
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope: "child",
            name: "child",
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
                        kind: "child-name",
                        parentCursor: "entry",
                        name: "child",
                    },
                },
                {
                    kind: "attempt",
                    steps: [
                        {
                            kind: "mutate",
                            cursor: "child",
                            mutation: {
                                kind: "set-atom",
                                atom: "count",
                                value: value.number(3),
                            },
                        },
                        { kind: "raise", code: "INNER_FAILURE" },
                    ],
                },
                {
                    kind: "read",
                    cursor: "child",
                    target: { kind: "atom", atom: "count" },
                    as: "after-catch",
                },
                {
                    kind: "attempt",
                    steps: [
                        {
                            kind: "resolve-cursor",
                            cursor: "missing",
                            target: {
                                kind: "child-name",
                                parentCursor: "entry",
                                name: "missing",
                            },
                        },
                    ],
                },
            ],
        })
        expect(model.trace).toContainEqual({
            kind: "attempt-error",
            code: "INNER_FAILURE",
        })
        expect(model.trace).toContainEqual({
            kind: "attempt-error",
            code: "SCOPE_NOT_FOUND",
        })
        expect(readNumber(model, "child")).toBe(3)

        ok(model, { kind: "create-tree", tree: "other", root: "child" })
        expect(
            model.execute({
                kind: "transact",
                tree: "tree",
                entryScope: "root",
                steps: [
                    {
                        kind: "resolve-cursor",
                        cursor: "same-id-foreign-tree",
                        target: {
                            kind: "scope",
                            tree: "other",
                            scope: "child",
                        },
                    },
                ],
            }),
        ).toMatchObject({
            ok: false,
            committed: false,
            error: "STORE_TREE_MISMATCH",
        })
        expect(readNumber(model, "child")).toBe(3)
    })

    test("V1M-TXN-003 compares every candidate to the fixed entry baseline", () => {
        const model = atomModel()
        ok(model, {
            kind: "define-atom",
            atom: {
                id: "fuzzy",
                fallback: { kind: "eager", value: value.number(0) },
                equal: { kind: "number-distance", maximum: 1 },
            },
        })
        ok(model, {
            kind: "transact",
            tree: "tree",
            entryScope: "root",
            steps: [
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-atom",
                        atom: "fuzzy",
                        value: value.number(2),
                    },
                },
                {
                    kind: "read",
                    cursor: "entry",
                    target: { kind: "atom", atom: "fuzzy" },
                    as: "two",
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "update-atom",
                        atom: "fuzzy",
                        updater: { kind: "number-add", amount: 1 },
                    },
                },
                {
                    kind: "read",
                    cursor: "entry",
                    target: { kind: "atom", atom: "fuzzy" },
                    as: "three",
                },
            ],
        })
        expect(model.trace).toContainEqual({
            kind: "read",
            as: "two",
            outcome: { kind: "value", value: value.number(2) },
        })
        expect(model.trace).toContainEqual({
            kind: "read",
            as: "three",
            outcome: { kind: "value", value: value.number(3) },
        })
    })

    test("V1M-TXN-004 keeps earlier intents only when the outer script catches", () => {
        const model = atomModel()
        ok(model, {
            kind: "transact",
            tree: "tree",
            entryScope: "root",
            steps: [
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-atom",
                        atom: "count",
                        value: value.number(5),
                    },
                },
                {
                    kind: "attempt",
                    steps: [
                        {
                            kind: "mutate",
                            cursor: "entry",
                            mutation: {
                                kind: "update-atom",
                                atom: "count",
                                updater: {
                                    kind: "fail",
                                    code: "UPDATER_FAILED",
                                },
                            },
                        },
                    ],
                },
            ],
        })
        expect(readNumber(model, "root")).toBe(5)

        const result = model.execute({
            kind: "transact",
            tree: "tree",
            entryScope: "root",
            steps: [
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-atom",
                        atom: "count",
                        value: value.number(8),
                    },
                },
                { kind: "raise", code: "ESCAPED" },
            ],
        })
        expect(result).toMatchObject({
            ok: false,
            committed: false,
            error: "ESCAPED",
        })
        expect(readNumber(model, "root")).toBe(5)

        const nestedReturn = model.execute({
            kind: "transact",
            tree: "tree",
            entryScope: "root",
            steps: [
                {
                    kind: "attempt",
                    steps: [{ kind: "return", value: value.number(7) }],
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-atom",
                        atom: "count",
                        value: value.number(9),
                    },
                },
            ],
        })
        expect(nestedReturn).toMatchObject({
            ok: true,
            committed: true,
            value: value.number(7),
        })
        expect(readNumber(model, "root")).toBe(5)

        expect(
            model.execute({
                kind: "transact",
                tree: "tree",
                entryScope: "root",
                steps: [
                    {
                        kind: "attempt",
                        steps: [
                            {
                                kind: "return",
                                value: value.identity(
                                    "thenable",
                                    "async-result",
                                ),
                            },
                        ],
                    },
                ],
            }),
        ).toMatchObject({
            ok: false,
            committed: false,
            error: "INVALID_TRANSACTION_CALLBACK_RESULT",
        })
    })

    test("V1M-TXN-005 read-only drafts publish no commit or lazy fallback", () => {
        const model = atomModel()
        ok(model, {
            kind: "define-atom",
            atom: {
                id: "lazy",
                fallback: { kind: "lazy", value: value.number(11) },
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
                    target: { kind: "atom", atom: "lazy" },
                    as: "private-lazy",
                },
            ],
        })
        expect(model.audit).toEqual([
            {
                kind: "lazy-fallback-resolved",
                tree: "tree",
                atom: "lazy",
                committed: false,
            },
        ])

        model.clearEvents()
        expect(readNumber(model, "root", "lazy")).toBe(11)
        expect(model.audit).toEqual([
            {
                kind: "lazy-fallback-resolved",
                tree: "tree",
                atom: "lazy",
                committed: true,
            },
        ])

        model.clearEvents()
        ok(model, {
            kind: "transact",
            tree: "tree",
            entryScope: "root",
            steps: [
                {
                    kind: "read",
                    cursor: "entry",
                    target: { kind: "atom", atom: "lazy" },
                    as: "reuse-committed-lazy",
                },
            ],
        })
        expect(model.audit).toEqual([])

        ok(model, {
            kind: "define-atom",
            atom: {
                id: "lazy-set",
                fallback: { kind: "lazy", value: value.number(13) },
            },
        })
        model.clearEvents()
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: {
                kind: "set-atom",
                atom: "lazy-set",
                value: value.number(13),
            },
        })
        expect(
            model.audit.filter(
                event => event.kind === "lazy-fallback-resolved",
            ),
        ).toEqual([
            {
                kind: "lazy-fallback-resolved",
                tree: "tree",
                atom: "lazy-set",
                committed: false,
            },
        ])
        model.clearEvents()
        expect(readNumber(model, "root", "lazy-set")).toBe(13)
        expect(model.audit).toEqual([])

        ok(model, {
            kind: "define-atom",
            atom: {
                id: "lazy-reset",
                fallback: { kind: "lazy", value: value.number(17) },
            },
        })
        model.clearEvents()
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "root",
            mutation: { kind: "reset-atom", atom: "lazy-reset" },
        })
        expect(model.audit).toEqual([
            {
                kind: "lazy-fallback-resolved",
                tree: "tree",
                atom: "lazy-reset",
                committed: false,
            },
        ])
        model.clearEvents()
        expect(readNumber(model, "root", "lazy-reset")).toBe(17)
        expect(model.audit).toEqual([])
    })
})
