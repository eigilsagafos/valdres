import { describe, expect, test } from "bun:test"
import { value } from "./index"
import { atomModel, lastCommit, ok } from "./test-helpers"

describe("v1 reference model subscriptions", () => {
    test("V1M-SUB-001 selects notifications only after the final transaction state", () => {
        const model = atomModel()
        ok(model, {
            kind: "subscribe",
            tree: "tree",
            scope: "root",
            target: { kind: "atom", atom: "count" },
            subscription: "root-count",
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
                        kind: "set-atom",
                        atom: "count",
                        value: value.number(1),
                    },
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-atom",
                        atom: "count",
                        value: value.number(2),
                    },
                },
            ],
        })
        expect(
            model.trace.filter(event => event.kind === "notifications"),
        ).toEqual([{ kind: "notifications", subscriptions: ["root-count"] }])
    })

    test("V1M-SUB-002 records equal ownership without notifying value subscribers", () => {
        const model = atomModel(value.number(1))
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope: "child",
        })
        ok(model, {
            kind: "subscribe",
            tree: "tree",
            scope: "child",
            target: { kind: "atom", atom: "count" },
            subscription: "child-count",
        })
        model.clearEvents()
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
        expect(lastCommit(model).ownershipChanges).toHaveLength(1)
        expect(lastCommit(model).effectiveAtomChanges).toEqual([])
        expect(
            model.trace.some(event => event.kind === "notifications"),
        ).toBeFalse()

        model.clearEvents()
        ok(model, {
            kind: "mutate",
            tree: "tree",
            scope: "child",
            mutation: { kind: "reset-atom", atom: "count" },
        })
        expect(lastCommit(model).ownershipChanges).toHaveLength(1)
        expect(
            model.trace.some(event => event.kind === "notifications"),
        ).toBeFalse()
    })

    test("V1M-SUB-003 reports observation faults after the commit stays applied", () => {
        const model = atomModel()
        ok(model, {
            kind: "create-scope",
            tree: "tree",
            parent: "root",
            scope: "child",
        })
        ok(model, {
            kind: "subscribe",
            tree: "tree",
            scope: "root",
            target: { kind: "atom", atom: "count" },
            subscription: "faulting-observer",
            observe: [
                {
                    scope: "child",
                    target: { kind: "atom", atom: "count" },
                    as: "disposed-child",
                },
            ],
        })
        ok(model, {
            kind: "subscribe",
            tree: "tree",
            scope: "root",
            target: { kind: "atom", atom: "count" },
            subscription: "healthy-observer",
        })
        ok(model, { kind: "dispose", tree: "tree", scope: "child" })
        model.clearEvents()

        expect(
            model.execute({
                kind: "mutate",
                tree: "tree",
                scope: "root",
                mutation: {
                    kind: "set-atom",
                    atom: "count",
                    value: value.number(1),
                },
            }),
        ).toEqual({
            ok: false,
            error: "STORE_DISPOSED",
            committed: true,
        })
        expect(lastCommit(model).effectiveAtomChanges).toEqual([
            "root\u0000count",
        ])
        expect(model.trace).toContainEqual({
            kind: "notifications",
            subscriptions: ["faulting-observer", "healthy-observer"],
        })
        expect(model.trace).toContainEqual({
            kind: "transaction",
            status: "committed",
            error: "STORE_DISPOSED",
        })
        expect(
            model.execute({
                kind: "read",
                tree: "tree",
                scope: "root",
                target: { kind: "atom", atom: "count" },
                as: "applied-after-notification-error",
            }),
        ).toMatchObject({
            ok: true,
            outcome: { kind: "value", value: value.number(1) },
        })
    })
})
