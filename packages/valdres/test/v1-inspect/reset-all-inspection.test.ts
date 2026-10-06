// valdres/inspect for the experimental Transaction.resetAll(): the bulk
// reset is reported with existing record types only. Each staged reset is an
// ordinary `intent` / `collection-intent` reset; rows a restored membership
// gains or loses are `collection-membership` insert/remove details; a pure
// order restoration is visible only as the membership source publication.
import { describe, expect, test } from "bun:test"
import { atom, collection } from "../../src/index"
import {
    createInspectableStore,
    type InspectionDetail,
    type InspectionExport,
    type OperationInspection,
} from "../../src/inspect"

const lastOperation = (report: InspectionExport): OperationInspection =>
    report.summaries
        .filter(
            (summary): summary is OperationInspection =>
                summary.type === "operation",
        )
        .at(-1)!

/** Detail kinds of one commit as `type:change[:target id]`. */
const commitDetails = (
    report: InspectionExport,
    commitId: number | undefined,
): string[] =>
    report.details
        .filter(
            (detail: InspectionDetail) =>
                "commitId" in detail && detail.commitId === commitId,
        )
        .map(detail => {
            switch (detail.type) {
                case "intent":
                    return `intent:${detail.intent}:${detail.atom.id}`
                case "collection-intent":
                    return `collection-intent:${detail.intent}:${detail.row.id}`
                case "collection-membership":
                    return `collection-membership:${detail.change}:${detail.scope.id}:${detail.row.id}`
                case "collection-source":
                    return `collection-source:${detail.action}:${detail.source}:${detail.scope.id}`
                default:
                    return detail.type
            }
        })

const keys = (rows: readonly { key: string }[]) => rows.map(row => row.key)

const fixture = () => {
    const rows = collection<string, string>({ name: "rows" })
    const count = atom(0, { name: "count" })
    const { store: root, inspect } = createInspectableStore()
    for (const key of ["a", "b", "c", "d"]) root.set(rows(key), key)
    const draft = root.scope("draft")
    return { rows, count, root, inspect, draft }
}

describe("valdres/inspect resetAll", () => {
    test("reports the bulk reset with the record types of the equivalent per-state resets", () => {
        const run = (bulk: boolean) => {
            const { rows, count, root, inspect, draft } = fixture()
            draft.set(count, 3)
            draft.delete(rows("b"))
            draft.set(rows("c"), "C")
            const childCapture = inspect.capture(draft, rows)
            const unsubscribe = draft.sub(rows, () => undefined)
            root.txn(transaction => {
                const cursor = transaction.scope(draft)
                if (bulk) cursor.resetAll()
                else {
                    cursor.reset(count)
                    cursor.reset(rows("b"))
                    cursor.reset(rows("c"))
                }
            })
            unsubscribe()
            const report = inspect.export()
            const operation = lastOperation(report)
            expect(operation).toMatchObject({
                operation: "transaction",
                effect: "committed",
                result: "returned",
            })
            const draftId = childCapture.store.id
            const ids = {
                count: inspect.capture(root, count).state!.id,
                b: inspect.capture(root, rows("b")).state!.id,
                c: inspect.capture(root, rows("c")).state!.id,
            }
            return {
                order: keys(draft.get(rows)),
                details: commitDetails(report, operation.commitId),
                expected: [
                    `intent:reset:${ids.count}`,
                    `collection-membership:insert:${draftId}:${ids.b}`,
                    `collection-intent:reset:${ids.b}`,
                    `collection-intent:reset:${ids.c}`,
                    `collection-source:published:membership:${draftId}`,
                ],
            }
        }
        const bulk = run(true)
        const loop = run(false)
        expect(bulk.details).toEqual(bulk.expected)
        expect(loop.details).toEqual(loop.expected)
        // only the order differs: the bulk reset restores the parent's
        expect(bulk.order).toEqual(["a", "b", "c", "d"])
        expect(loop.order).toEqual(["a", "c", "d", "b"])
    })

    test("a pure order restoration reports only the membership publication", () => {
        const { rows, root, inspect, draft } = fixture()
        draft.delete(rows("a"))
        draft.reset(rows("a"))
        expect(keys(draft.get(rows))).toEqual(["b", "c", "d", "a"])
        const draftCapture = inspect.capture(draft, rows)
        root.txn(transaction => transaction.scope(draft).resetAll())
        expect(keys(draft.get(rows))).toEqual(["a", "b", "c", "d"])
        const report = inspect.export()
        expect(commitDetails(report, lastOperation(report).commitId)).toEqual([
            `collection-source:published:membership:${draftCapture.store.id}`,
        ])
    })

    test("a mirroring descendant reports its own membership insert", () => {
        const { rows, root, inspect, draft } = fixture()
        draft.delete(rows("b"))
        const child = draft.scope("child")
        expect(keys(child.get(rows))).toEqual(["a", "c", "d"])
        const draftCapture = inspect.capture(draft, rows)
        const childCapture = inspect.capture(child, rows)
        const b = inspect.capture(root, rows("b")).state!.id
        const unsubscribe = child.sub(rows, () => undefined)
        root.txn(transaction => transaction.scope(draft).resetAll())
        unsubscribe()
        expect(keys(child.get(rows))).toEqual(["a", "b", "c", "d"])
        const report = inspect.export()
        const details = commitDetails(report, lastOperation(report).commitId)
        expect(details).toContain(
            `collection-membership:insert:${draftCapture.store.id}:${b}`,
        )
        expect(details).toContain(
            `collection-membership:insert:${childCapture.store.id}:${b}`,
        )
        expect(details).toContain(
            `collection-source:published:membership:${childCapture.store.id}`,
        )
    })

    test("a scope that owns nothing commits nothing", () => {
        const { root, inspect, draft } = fixture()
        const before = inspect.export().details.length
        root.txn(transaction => transaction.scope(draft).resetAll())
        const report = inspect.export()
        expect(lastOperation(report)).toMatchObject({
            operation: "transaction",
            effect: "none",
        })
        expect(report.details.length).toBe(before)
    })

    test("a rejected root reset records a thrown transaction and no commit", () => {
        const { root, inspect } = fixture()
        expect(() => root.txn(transaction => transaction.resetAll())).toThrow(
            TypeError,
        )
        expect(lastOperation(inspect.export())).toMatchObject({
            operation: "transaction",
            result: "threw",
            effect: "none",
        })
    })
})
