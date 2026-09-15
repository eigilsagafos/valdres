import { expect, test } from "./test-compat"
import { collection } from "../../src/index"
import { query } from "../../src/query"
import { createInspectableStore } from "../../src/inspect"

test("materialized equality indexes visit changed rows and affected buckets at 1k/5k/20k", () => {
    for (const size of [1000, 5000, 20000]) {
        type Entity = { kind: "task" | "person" | "document"; title: string }
        let calls = 0
        const entities = collection<
            string,
            Entity,
            string,
            { kind: Entity["kind"] }
        >({
            indexes: {
                kind: value => {
                    calls++
                    return value.kind
                },
            },
        })
        const { store: s, inspect } = createInspectableStore({
            capacity: { summaries: 32, details: 0 },
        })
        s.txn(tx => {
            for (let i = 0; i < size; i++)
                tx.set(entities(String(i)), {
                    kind: i < 10 ? "task" : "document",
                    title: "initial",
                })
        })
        expect(calls).toBe(0)
        const tasks = query(entities, { where: { kind: { eq: "task" } } })
        expect(s.get(tasks).length).toBe(10)
        expect(calls).toBe(size)
        inspect.reset()
        const extra = entities("extra")
        s.set(extra, { kind: "task", title: "insert" })
        s.set(extra, { kind: "task", title: "update" })
        s.set(extra, { kind: "person", title: "move" })
        s.delete(extra)
        const result = s.get(tasks)
        for (let i = 0; i < 100; i++) expect(s.get(tasks)).toBe(result)
        expect(calls).toBe(size + 3)
        inspect.reset()
        s.set(extra, { kind: "task", title: "again" })
        s.set(extra, { kind: "task", title: "value" })
        s.delete(extra)
        const writes = inspect
            .export()
            .summaries.filter(summary => summary.type === "operation")
        expect(writes).toHaveLength(3)
        expect(
            writes.map(item => item.totals.collectionIndexDeltaRows),
        ).toEqual([1, 1, 1])
        expect(
            writes.map(item => item.totals.collectionIndexExtractorCalls),
        ).toEqual([1, 1, 0])
        expect(
            writes.map(item => item.totals.collectionIndexBucketRows),
        ).toEqual([11, 0, 10])
        for (const write of writes) {
            expect(
                write.totals.collectionMembershipRowsScanned,
            ).toBeLessThanOrEqual(1)
            expect(write.totals.collectionMembershipArrayAllocations).toBe(0)
        }
        s.dispose()
    }
})

test("index inspection is numeric and bounded, and unused indexes have no maintenance", () => {
    const indexed = collection<
        string,
        { kind: string },
        string,
        { kind: string }
    >({ indexes: { kind: value => value.kind } })
    const plain = collection<string, { kind: string }>()
    const { store: s, inspect } = createInspectableStore({
        capacity: { summaries: 8, details: 0 },
    })
    const unseen = query(indexed, { where: { kind: { eq: "PRIVATE_VALUE" } } })
    s.set(indexed("PRIVATE_KEY"), { kind: "PRIVATE_VALUE" })
    const before = inspect
        .export()
        .summaries.find(summary => summary.type === "operation")!
    expect(before.totals.collectionIndexMaterializations).toBe(0)
    expect(before.totals.collectionIndexExtractorCalls).toBe(0)
    s.get(unseen)
    inspect.reset()
    s.set(plain("PLAIN_PRIVATE_KEY"), { kind: "PRIVATE_VALUE" })
    expect(
        inspect
            .export()
            .summaries.find(summary => summary.type === "operation")!.totals
            .collectionIndexDeltaRows,
    ).toBe(0)
    s.set(indexed("PRIVATE_KEY"), { kind: "OTHER_PRIVATE_VALUE" })
    const report = JSON.stringify(inspect.export())
    expect(report).not.toContain("PRIVATE_KEY")
    expect(report).not.toContain("PRIVATE_VALUE")
    s.dispose()
})

test("index delta routing excludes membership-only sibling subtrees", () => {
    const entities = collection<
        string,
        { kind: string },
        string,
        { kind: string }
    >({ indexes: { kind: value => value.kind } })
    const { store: s, inspect } = createInspectableStore({
        capacity: { summaries: 4, details: 0 },
    })
    const tasks = query(entities, { where: { kind: { eq: "task" } } })
    s.set(entities("one"), { kind: "task" })
    s.get(tasks)
    for (let i = 0; i < 5000; i++) s.scope(String(i)).get(entities)
    const indexedChild = s.scope("indexed")
    indexedChild.get(tasks)
    inspect.reset()
    s.set(entities("one"), { kind: "person" })
    const write = inspect
        .export()
        .summaries.find(summary => summary.type === "operation")!
    if (write === undefined) throw new Error(JSON.stringify(inspect.export()))
    expect(write.totals.collectionIndexRouteVisits).toBe(2)
    expect(write.totals.collectionIndexDeltaRows).toBe(2)
    expect(s.get(tasks)).toEqual([])
    expect(indexedChild.get(tasks)).toEqual([])
    s.dispose()
})

test("scratch query scans do not create row draft coordinates for untouched rows", async () => {
    const { getCollectionKernel } = await import(
        "../../src/v1-internal/committed-store-tree/committed-store-tree"
    )
    const { v1Domain } = await import("../../src/v1-internal/public-domain")
    const entities = collection<
        number,
        { kind: string },
        number,
        { kind: string }
    >({ indexes: { kind: value => value.kind } })
    const { store: s } = createInspectableStore()
    s.txn(tx => {
        for (let i = 0; i < 5000; i++) tx.set(entities(i), { kind: "task" })
    })
    const kernel = getCollectionKernel(
        v1Domain,
    ) as import("../../src/v1-internal/collection-kernel").CollectionDraftKernel
    const finish = kernel.beginMembershipPlacementTraceForTest()
    const tasks = query(entities, { where: { kind: { eq: "task" } } })
    s.txn(tx => {
        expect(tx.get(tasks).length).toBe(5000)
        tx.set(entities(0), { kind: "person" })
        expect(tx.get(tasks).length).toBe(4999)
    })
    expect(finish().coordinates).toBe(1)
    s.dispose()
})
