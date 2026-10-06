import { describe, expect, test } from "bun:test"
import {
    createReferenceModel,
    value,
    type Command,
    type ReadOutcome,
    type ReferenceModel,
    type TransactionStep,
} from "./index"
import { ok, read } from "./test-helpers"

/** root a,b,c,d (+ optional rows defined but absent), one atom, scopes. */
function model(
    rowsPresent: readonly string[] = ["a", "b", "c", "d"],
    extraRows: readonly string[] = [],
): ReferenceModel {
    const m = createReferenceModel()
    ok(m, {
        kind: "define-atom",
        atom: {
            id: "count",
            fallback: { kind: "eager", value: value.number(0) },
        },
    })
    ok(m, { kind: "define-collection", collection: { id: "movies" } })
    for (const row of [...rowsPresent, ...extraRows])
        ok(m, { kind: "define-row", collection: "movies", row, key: row })
    ok(m, { kind: "create-tree", tree: "tree", root: "root" })
    for (const row of rowsPresent)
        mutate(m, "root", { kind: "set-row", row, value: value.string(row) })
    return m
}

function scope(m: ReferenceModel, parent: string, id: string): void {
    ok(m, { kind: "create-scope", tree: "tree", parent, scope: id, name: id })
}

function mutate(
    m: ReferenceModel,
    scopeId: string,
    mutation: Extract<Command, { kind: "mutate" }>["mutation"],
): void {
    ok(m, { kind: "mutate", tree: "tree", scope: scopeId, mutation })
}

const cursor = (name: string, scopeId: string): TransactionStep => ({
    kind: "resolve-cursor",
    cursor: name,
    target: { kind: "scope", tree: "tree", scope: scopeId },
})
const clear = (name: string): TransactionStep => ({
    kind: "reset-all",
    cursor: name,
})
const readRows = (name: string, as: string): TransactionStep => ({
    kind: "read",
    cursor: name,
    target: { kind: "collection", collection: "movies" },
    as,
})

function transact(
    m: ReferenceModel,
    steps: readonly TransactionStep[],
): ReturnType<ReferenceModel["execute"]> {
    m.clearEvents()
    return m.execute({
        kind: "transact",
        tree: "tree",
        entryScope: "root",
        steps,
    })
}

function rowsOf(m: ReferenceModel, scopeId: string): readonly string[] {
    const outcome = read(m, scopeId, {
        kind: "collection",
        collection: "movies",
    })
    return (outcome as Extract<ReadOutcome, { kind: "rows" }>).rows
}

function tracedRows(m: ReferenceModel, as: string): readonly string[] {
    const event = m.trace.find(
        entry => entry.kind === "read" && entry.as === as,
    ) as Extract<(typeof m.trace)[number], { kind: "read" }>
    return (event.outcome as Extract<ReadOutcome, { kind: "rows" }>).rows
}

describe("v1 reference model resetAll", () => {
    test("V1M-RESETALL-001 clears every local override, including staged ones, and rejects roots", () => {
        const m = model()
        scope(m, "root", "draft")
        mutate(m, "draft", {
            kind: "set-atom",
            atom: "count",
            value: value.number(5),
        })
        mutate(m, "draft", { kind: "delete-row", row: "b" })
        mutate(m, "draft", {
            kind: "set-row",
            row: "c",
            value: value.string("C"),
        })
        expect(
            transact(m, [
                cursor("d", "draft"),
                {
                    kind: "mutate",
                    cursor: "d",
                    mutation: { kind: "delete-row", row: "a" },
                },
                clear("d"),
                {
                    kind: "read",
                    cursor: "d",
                    target: { kind: "atom", atom: "count" },
                    as: "atom",
                },
            ]).ok,
        ).toBeTrue()
        expect(rowsOf(m, "draft")).toEqual(["a", "b", "c", "d"])
        expect(read(m, "draft", { kind: "row", row: "c" })).toEqual({
            kind: "value",
            value: value.string("c"),
        })
        expect(read(m, "draft", { kind: "atom", atom: "count" })).toEqual({
            kind: "value",
            value: value.number(0),
        })
        const rejected = transact(m, [clear("entry")])
        expect(rejected).toMatchObject({
            ok: false,
            error: "RESET_ALL_REQUIRES_CHILD_SCOPE",
        })
        // an untouched scope is a no-op: no commit is recorded
        scope(m, "root", "untouched")
        const commitsBefore = m.audit.filter(e => e.kind === "commit").length
        expect(
            transact(m, [cursor("u", "untouched"), clear("u")]).ok,
        ).toBeTrue()
        expect(m.audit.filter(e => e.kind === "commit").length).toBe(
            commitsBefore,
        )
    })

    test("V1M-RESETALL-002 restores the untouched-child membership order", () => {
        const m = model(["a", "b", "c", "d"], ["z"])
        scope(m, "root", "draft")
        mutate(m, "draft", { kind: "delete-row", row: "b" })
        expect(rowsOf(m, "draft")).toEqual(["a", "c", "d"])
        expect(
            transact(m, [
                cursor("d", "draft"),
                clear("d"),
                readRows("d", "after-clear"),
            ]).ok,
        ).toBeTrue()
        expect(tracedRows(m, "after-clear")).toEqual(["a", "b", "c", "d"])
        expect(rowsOf(m, "draft")).toEqual(["a", "b", "c", "d"])
        mutate(m, "root", {
            kind: "set-row",
            row: "z",
            value: value.string("z"),
        })
        expect(rowsOf(m, "draft")).toEqual(["a", "b", "c", "d", "z"])
        // order-only residue from single resets is restored as well
        mutate(m, "draft", { kind: "delete-row", row: "a" })
        mutate(m, "draft", { kind: "reset-row", row: "a" })
        expect(rowsOf(m, "draft")).toEqual(["b", "c", "d", "z", "a"])
        transact(m, [cursor("d", "draft"), clear("d")])
        expect(rowsOf(m, "draft")).toEqual(["a", "b", "c", "d", "z"])
    })

    test("V1M-RESETALL-003 interleaves parent and post-clear writes by intent order; repeated clears discard earlier writes", () => {
        const m = model(["a", "b", "c"], ["p", "q", "x", "y"])
        scope(m, "root", "draft")
        mutate(m, "draft", { kind: "delete-row", row: "a" })
        expect(
            transact(m, [
                cursor("d", "draft"),
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-row",
                        row: "p",
                        value: value.string("p"),
                    },
                },
                clear("d"),
                {
                    kind: "mutate",
                    cursor: "d",
                    mutation: {
                        kind: "set-row",
                        row: "x",
                        value: value.string("x"),
                    },
                },
                {
                    kind: "mutate",
                    cursor: "entry",
                    mutation: {
                        kind: "set-row",
                        row: "q",
                        value: value.string("q"),
                    },
                },
                readRows("d", "first"),
                clear("d"),
                {
                    kind: "mutate",
                    cursor: "d",
                    mutation: {
                        kind: "set-row",
                        row: "y",
                        value: value.string("y"),
                    },
                },
                readRows("d", "second"),
            ]).ok,
        ).toBeTrue()
        expect(tracedRows(m, "first")).toEqual(["a", "b", "c", "p", "x", "q"])
        expect(tracedRows(m, "second")).toEqual(["a", "b", "c", "p", "q", "y"])
        expect(rowsOf(m, "draft")).toEqual(["a", "b", "c", "p", "q", "y"])
    })

    test("V1M-RESETALL-004 mirroring descendants follow; history-keeping descendants keep their order", () => {
        const m = model(["a", "b", "c", "d"], ["n"])
        scope(m, "root", "draft")
        mutate(m, "draft", { kind: "delete-row", row: "b" })
        mutate(m, "draft", {
            kind: "set-row",
            row: "d",
            value: value.string("D"),
        })
        scope(m, "draft", "untouched")
        scope(m, "draft", "value-only")
        mutate(m, "value-only", {
            kind: "set-row",
            row: "a",
            value: value.string("A"),
        })
        scope(m, "draft", "owner")
        mutate(m, "owner", {
            kind: "set-row",
            row: "n",
            value: value.string("n"),
        })
        mutate(m, "owner", { kind: "delete-row", row: "c" })
        scope(m, "draft", "residue")
        mutate(m, "residue", { kind: "delete-row", row: "a" })
        mutate(m, "residue", { kind: "reset-row", row: "a" })
        transact(m, [cursor("d", "draft"), clear("d")])
        expect(rowsOf(m, "draft")).toEqual(["a", "b", "c", "d"])
        expect(rowsOf(m, "untouched")).toEqual(["a", "b", "c", "d"])
        expect(rowsOf(m, "value-only")).toEqual(["a", "b", "c", "d"])
        expect(rowsOf(m, "owner")).toEqual(["a", "d", "n", "b"])
        expect(rowsOf(m, "residue")).toEqual(["c", "d", "a", "b"])
        expect(read(m, "value-only", { kind: "row", row: "a" })).toEqual({
            kind: "value",
            value: value.string("A"),
        })
    })

    test("V1M-RESETALL-005 nested clears use the nearest non-restore-derived ancestor", () => {
        const m = model(["a", "b", "c"], ["m", "extra"])
        scope(m, "root", "ancestor")
        mutate(m, "ancestor", { kind: "delete-row", row: "b" })
        scope(m, "ancestor", "middle")
        scope(m, "middle", "leaf")
        mutate(m, "leaf", {
            kind: "set-row",
            row: "extra",
            value: value.string("extra"),
        })
        transact(m, [
            cursor("anc", "ancestor"),
            cursor("leaf", "leaf"),
            clear("anc"),
            clear("leaf"),
        ])
        expect(rowsOf(m, "middle")).toEqual(["a", "b", "c"])
        expect(rowsOf(m, "leaf")).toEqual(["a", "b", "c"])

        // a history-keeping middle: the cleared leaf equals the middle
        const h = model(["a", "b", "c"], ["m"])
        scope(h, "root", "ancestor")
        mutate(h, "ancestor", { kind: "delete-row", row: "b" })
        scope(h, "ancestor", "middle")
        mutate(h, "middle", {
            kind: "set-row",
            row: "m",
            value: value.string("m"),
        })
        scope(h, "middle", "leaf")
        mutate(h, "leaf", { kind: "delete-row", row: "a" })
        transact(h, [
            cursor("anc", "ancestor"),
            cursor("leaf", "leaf"),
            clear("anc"),
            clear("leaf"),
        ])
        expect(rowsOf(h, "middle")).toEqual(["a", "c", "m", "b"])
        expect(rowsOf(h, "leaf")).toEqual(["a", "c", "m", "b"])
    })

    test("V1M-RESETALL-006 an aborted transaction leaves ownership and order untouched", () => {
        const m = model()
        scope(m, "root", "draft")
        mutate(m, "draft", { kind: "delete-row", row: "b" })
        const before = read(m, "draft", {
            kind: "collection",
            collection: "movies",
        })
        expect(
            transact(m, [
                cursor("d", "draft"),
                clear("d"),
                { kind: "raise", code: "ABORT" },
            ]),
        ).toMatchObject({ ok: false, error: "ABORT" })
        expect(
            read(m, "draft", { kind: "collection", collection: "movies" }),
        ).toEqual(before)
    })

    test("V1M-RESETALL-007 an explicitly cleared scope restores in every collection; an uncleared writer keeps its history", () => {
        // root a,b,c,d; ancestor hides b; child never wrote rows (or only
        // overrode a value). Clearing the child restores it as an untouched
        // child of the restored ancestor whether or not it owned rows, in
        // either clear order; its later presence-neutral write keeps that
        // order. Without the explicit clear, the writing child keeps its own
        // order history and the revealed row is appended.
        const build = (
            childOwnsRow: boolean,
            clears: readonly string[],
        ): ReferenceModel => {
            const m = model()
            scope(m, "root", "ancestor")
            mutate(m, "ancestor", { kind: "delete-row", row: "b" })
            scope(m, "ancestor", "child")
            if (childOwnsRow)
                mutate(m, "child", {
                    kind: "set-row",
                    row: "c",
                    value: value.string("c"),
                })
            const steps: TransactionStep[] = [
                cursor("anc", "ancestor"),
                cursor("child", "child"),
                ...clears.map(clear),
                {
                    kind: "mutate",
                    cursor: "child",
                    mutation: {
                        kind: "set-row",
                        row: "a",
                        value: value.string("A"),
                    },
                },
                readRows("child", "after-write"),
            ]
            expect(transact(m, steps).ok).toBeTrue()
            return m
        }
        for (const owns of [false, true]) {
            for (const clears of [
                ["anc", "child"],
                ["child", "anc"],
            ]) {
                const m = build(owns, clears)
                expect(rowsOf(m, "ancestor")).toEqual(["a", "b", "c", "d"])
                expect(tracedRows(m, "after-write")).toEqual([
                    "a",
                    "b",
                    "c",
                    "d",
                ])
                expect(rowsOf(m, "child")).toEqual(["a", "b", "c", "d"])
                expect(read(m, "child", { kind: "row", row: "c" })).toEqual({
                    kind: "value",
                    value: value.string("c"),
                })
            }
            const control = build(owns, ["anc"])
            expect(tracedRows(control, "after-write")).toEqual([
                "a",
                "c",
                "d",
                "b",
            ])
            expect(rowsOf(control, "child")).toEqual(["a", "c", "d", "b"])
        }
    })
})
