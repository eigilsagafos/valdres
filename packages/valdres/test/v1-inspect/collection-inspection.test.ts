import { describe, expect, test } from "bun:test"
import {
    SubscriberNotificationError,
    atom,
    collection,
    presence,
} from "../../src/index"
import {
    createInspectableStore,
    type InspectionExport,
    type InspectionWorkTotals,
    type OperationInspection,
} from "../../src/inspect"
import { createCollectionDefinition } from "../../src/v1-internal/collection"
import { createCommittedStoreTreeDomain } from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import * as COLLECTION_PROTOCOL from "../../src/v1-internal/collection-inspection-protocol"

const collectionCounterNames = [
    "collectionRowIntentsStaged",
    "collectionRowIntentStorageAllocations",
    "collectionRowFinalResolutionVisits",
    "collectionRowRouteVisits",
    "collectionMembershipRecordCreations",
    "collectionMembershipRouteVisits",
    "collectionMembershipRowsScanned",
    "collectionMembershipArrayAllocations",
    "collectionRowSourcesChanged",
    "collectionMembershipSourcesChanged",
    "collectionEffectiveDeltasPrepared",
    "collectionOwnerRetentionSetsCreated",
    "collectionOwnerRetains",
    "collectionOwnerReleases",
] as const satisfies readonly (keyof InspectionWorkTotals)[]

type CollectionTotals = Pick<
    InspectionWorkTotals,
    (typeof collectionCounterNames)[number]
>

const collectionTotals = (totals: InspectionWorkTotals): CollectionTotals =>
    Object.freeze(
        Object.fromEntries(
            collectionCounterNames.map(name => [name, totals[name]]),
        ),
    ) as CollectionTotals

const zeroCollectionTotals = (): CollectionTotals =>
    Object.freeze(
        Object.fromEntries(collectionCounterNames.map(name => [name, 0])),
    ) as CollectionTotals

const operations = (report: InspectionExport): readonly OperationInspection[] =>
    report.summaries.filter(
        (summary): summary is OperationInspection =>
            summary.type === "operation",
    )

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("valdres/inspect collection structural diagnostics", () => {
    test("freezes the append-only numeric collection protocol", () => {
        expect([
            COLLECTION_PROTOCOL.COLLECTION_ROW_INTENTS_STAGED,
            COLLECTION_PROTOCOL.COLLECTION_ROW_INTENT_STORAGE_ALLOCATIONS,
            COLLECTION_PROTOCOL.COLLECTION_ROW_FINAL_RESOLUTION_VISITS,
            COLLECTION_PROTOCOL.COLLECTION_ROW_ROUTE_VISITS,
            COLLECTION_PROTOCOL.COLLECTION_MEMBERSHIP_RECORD_CREATIONS,
            COLLECTION_PROTOCOL.COLLECTION_MEMBERSHIP_ROUTE_VISITS,
            COLLECTION_PROTOCOL.COLLECTION_MEMBERSHIP_ROWS_SCANNED,
            COLLECTION_PROTOCOL.COLLECTION_MEMBERSHIP_ARRAY_ALLOCATIONS,
            COLLECTION_PROTOCOL.COLLECTION_ROW_SOURCES_CHANGED,
            COLLECTION_PROTOCOL.COLLECTION_MEMBERSHIP_SOURCES_CHANGED,
            COLLECTION_PROTOCOL.COLLECTION_EFFECTIVE_DELTAS_PREPARED,
            COLLECTION_PROTOCOL.COLLECTION_OWNER_RETENTION_SETS_CREATED,
            COLLECTION_PROTOCOL.COLLECTION_OWNER_RETAINS,
            COLLECTION_PROTOCOL.COLLECTION_OWNER_RELEASES,
        ]).toEqual([35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48])
        expect([
            COLLECTION_PROTOCOL.COLLECTION_INTENT_SET,
            COLLECTION_PROTOCOL.COLLECTION_INTENT_UPDATE,
            COLLECTION_PROTOCOL.COLLECTION_INTENT_RESET,
            COLLECTION_PROTOCOL.COLLECTION_INTENT_DELETE,
            COLLECTION_PROTOCOL.COLLECTION_EFFECTIVE_INSERT,
            COLLECTION_PROTOCOL.COLLECTION_EFFECTIVE_UPDATE,
            COLLECTION_PROTOCOL.COLLECTION_EFFECTIVE_REMOVE,
            COLLECTION_PROTOCOL.COLLECTION_MEMBERSHIP_INSERT,
            COLLECTION_PROTOCOL.COLLECTION_MEMBERSHIP_REMOVE,
            COLLECTION_PROTOCOL.COLLECTION_ROW_PUBLISHED,
            COLLECTION_PROTOCOL.COLLECTION_MEMBERSHIP_PUBLISHED,
            COLLECTION_PROTOCOL.COLLECTION_ROW_MATERIALIZED,
            COLLECTION_PROTOCOL.COLLECTION_MEMBERSHIP_MATERIALIZED,
        ]).toEqual([64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76])
        expect(
            Object.values(COLLECTION_PROTOCOL).every(
                code => typeof code === "number",
            ),
        ).toBe(true)
    })

    test("captures rows and collections as opaque same-domain references", () => {
        const secretKey = "DO_NOT_RETAIN_THIS_COLLECTION_KEY"
        const sessions = collection<string, { secret: string }>()
        const row = sessions(secretKey)
        const { store, inspect } = createInspectableStore()
        const before = inspect.export()

        const rowCapture = inspect.capture(store, row)
        const collectionCapture = inspect.capture(store, sessions)

        expect(inspect.export()).toEqual(before)
        expect(rowCapture.state).toEqual({
            id: expect.any(Number),
            kind: "collection-row",
        })
        expect(collectionCapture.state).toEqual({
            id: expect.any(Number),
            kind: "collection",
        })
        expect(rowCapture.state?.id).not.toBe(collectionCapture.state?.id)
        expect(Object.isFrozen(rowCapture.state)).toBe(true)
        expect(Object.isFrozen(collectionCapture.state)).toBe(true)
        expect(JSON.stringify([rowCapture, collectionCapture])).not.toContain(
            secretKey,
        )

        const foreignDomain = createCommittedStoreTreeDomain()
        const foreignCollection = createCollectionDefinition<string, number>(
            foreignDomain,
        )
        const foreignRow = foreignCollection("foreign")
        for (const foreignState of [foreignRow, foreignCollection]) {
            expect(
                thrownBy(() =>
                    Reflect.apply(inspect.capture, undefined, [
                        store,
                        foreignState,
                    ]),
                ),
            ).toBeInstanceOf(TypeError)
        }

        const descriptorTrap = new Error("descriptor must stay unread")
        const hostileFake = new Proxy(Object.freeze({}), {
            getOwnPropertyDescriptor: () => {
                throw descriptorTrap
            },
        })
        expect(
            thrownBy(() =>
                Reflect.apply(inspect.capture, undefined, [store, hostileFake]),
            ),
        ).toBeInstanceOf(TypeError)

        let kindReads = 0
        const accessorFake = Object.defineProperty({}, "kind", {
            get: () => {
                kindReads++
                throw descriptorTrap
            },
        })
        expect(
            thrownBy(() =>
                Reflect.apply(inspect.capture, undefined, [
                    store,
                    accessorFake,
                ]),
            ),
        ).toBeInstanceOf(TypeError)
        expect(kindReads).toBe(0)
        expect(inspect.export()).toEqual(before)
    })

    test("records exact insert and value-update work on materialized coordinates", () => {
        const sessions = collection<string, number>()
        const row = sessions("a")
        const { store, inspect } = createInspectableStore()
        expect(store.get(row)).toBeUndefined()
        expect(store.get(sessions)).toEqual([])
        inspect.reset()

        inspect.span("insert", () => store.set(row, 1))
        const inserted = inspect.export()
        const insertOperation = operations(inserted)[0]!

        expect(collectionTotals(insertOperation.totals)).toEqual({
            collectionRowIntentsStaged: 1,
            collectionRowIntentStorageAllocations: 1,
            collectionRowFinalResolutionVisits: 1,
            collectionRowRouteVisits: 1,
            collectionMembershipRecordCreations: 0,
            collectionMembershipRouteVisits: 2,
            collectionMembershipRowsScanned: 1,
            collectionMembershipArrayAllocations: 1,
            collectionRowSourcesChanged: 1,
            collectionMembershipSourcesChanged: 1,
            collectionEffectiveDeltasPrepared: 1,
            collectionOwnerRetentionSetsCreated: 1,
            collectionOwnerRetains: 1,
            collectionOwnerReleases: 0,
        })
        expect(insertOperation).toMatchObject({
            operation: "set",
            effect: "committed",
            commitId: expect.any(Number),
        })
        expect(
            inserted.details.filter(
                detail => detail.type === "collection-effective-delta",
            ),
        ).toEqual([
            expect.objectContaining({
                change: "insert",
                before: "absent",
                after: "present",
                membership: "insert",
                operationId: insertOperation.operationId,
                commitId: insertOperation.commitId,
                row: { id: expect.any(Number), kind: "collection-row" },
                collection: { id: expect.any(Number), kind: "collection" },
            }),
        ])

        inspect.reset()
        store.update(row, () => 2)
        const updated = inspect.export()
        expect(collectionTotals(operations(updated)[0]!.totals)).toEqual({
            collectionRowIntentsStaged: 1,
            collectionRowIntentStorageAllocations: 1,
            collectionRowFinalResolutionVisits: 1,
            collectionRowRouteVisits: 1,
            collectionMembershipRecordCreations: 0,
            collectionMembershipRouteVisits: 0,
            collectionMembershipRowsScanned: 0,
            collectionMembershipArrayAllocations: 0,
            collectionRowSourcesChanged: 1,
            collectionMembershipSourcesChanged: 0,
            collectionEffectiveDeltasPrepared: 1,
            collectionOwnerRetentionSetsCreated: 0,
            collectionOwnerRetains: 0,
            collectionOwnerReleases: 0,
        })
        expect(updated.details).toContainEqual(
            expect.objectContaining({
                type: "collection-effective-delta",
                change: "update",
                before: "present",
                after: "present",
                membership: "unchanged",
            }),
        )

        inspect.reset()
        store.update(row, current => current)
        const unchanged = inspect.export()
        expect(operations(unchanged)[0]).toMatchObject({ effect: "none" })
        expect(collectionTotals(operations(unchanged)[0]!.totals)).toEqual(
            zeroCollectionTotals(),
        )
        expect(unchanged.details).toEqual([])
    })

    test("distinguishes returned-to-baseline commits from lazy fallback publication", () => {
        const sessions = collection<string, number>()
        const row = sessions("a")
        const lazy = atom.lazy(() => 1)
        const { store, inspect } = createInspectableStore()
        store.set(row, 1)

        inspect.reset()
        store.txn(transaction => {
            transaction.delete(row)
            transaction.set(row, 1)
        })
        const returned = inspect.export()
        expect(operations(returned)[0]).toMatchObject({
            operation: "transaction",
            result: "returned",
            effect: "none",
            commitId: expect.any(Number),
        })
        expect(
            returned.summaries.find(summary => summary.type === "commit"),
        ).toMatchObject({
            changedSources: 0,
            ownershipChanged: false,
            sourceApplied: false,
        })

        inspect.reset()
        store.reset(lazy)
        const publishedFallback = inspect.export()
        expect(operations(publishedFallback)[0]).toMatchObject({
            operation: "reset",
            effect: "committed",
        })
        expect(
            publishedFallback.summaries.find(
                summary => summary.type === "commit",
            ),
        ).toMatchObject({
            changedSources: 0,
            ownershipChanged: false,
            sourceApplied: true,
        })
    })

    test("counts accepted histories but excludes rejected and read-only draft work", () => {
        const sessions = collection<string, number>()
        const row = sessions("a")
        const { store, inspect } = createInspectableStore()
        store.set(row, 1)

        const thenable = Object.freeze({ then: () => undefined })
        for (const rejected of [
            () => Reflect.apply(store.set, store, [row, undefined]),
            () => Reflect.apply(store.set, store, [row, thenable]),
            () => store.update(row, () => undefined as never),
            () => store.update(row, () => thenable as never),
            () =>
                store.update(row, () => {
                    throw new Error("rejected updater")
                }),
        ]) {
            inspect.reset()
            expect(thrownBy(rejected)).toBeDefined()
            expect(
                collectionTotals(operations(inspect.export())[0]!.totals),
            ).toEqual(zeroCollectionTotals())
        }

        inspect.reset()
        store.txn(transaction => {
            expect(transaction.get(row)).toBe(1)
            expect(transaction.get(sessions)).toEqual([row])
            expect(transaction.get(sessions)).toEqual([row])
        })
        const readOnly = operations(inspect.export())[0]!
        expect(collectionTotals(readOnly.totals)).toMatchObject({
            collectionRowIntentsStaged: 0,
            collectionRowIntentStorageAllocations: 0,
            collectionRowFinalResolutionVisits: 0,
        })

        inspect.reset()
        store.txn(transaction => {
            transaction.set(row, 2)
            transaction.set(row, 3)
            transaction.delete(row)
            transaction.set(row, 4)
        })
        const overwritten = inspect.export()
        const overwrittenOperation = operations(overwritten)[0]!
        expect(collectionTotals(overwrittenOperation.totals)).toMatchObject({
            collectionRowIntentsStaged: 4,
            collectionRowIntentStorageAllocations: 1,
            collectionRowFinalResolutionVisits: 1,
        })
        expect(
            overwritten.details.filter(
                detail => detail.type === "collection-intent",
            ),
        ).toEqual([
            expect.objectContaining({
                intent: "set",
                operationId: overwrittenOperation.operationId,
                commitId: overwrittenOperation.commitId,
            }),
        ])
    })

    test("separates semantic no-ops from ownership-only tombstones", () => {
        const sessions = collection<string, number>()
        const row = sessions("absent")
        const rootFixture = createInspectableStore()

        rootFixture.store.delete(row)
        const rootDelete = operations(rootFixture.inspect.export())[0]!
        expect(collectionTotals(rootDelete.totals)).toMatchObject({
            collectionEffectiveDeltasPrepared: 0,
            collectionRowSourcesChanged: 0,
            collectionMembershipSourcesChanged: 0,
            collectionOwnerRetentionSetsCreated: 0,
            collectionOwnerRetains: 0,
            collectionOwnerReleases: 0,
        })

        rootFixture.inspect.reset()
        rootFixture.store.reset(row)
        expect(
            collectionTotals(
                operations(rootFixture.inspect.export())[0]!.totals,
            ),
        ).toEqual(zeroCollectionTotals())

        const childFixture = createInspectableStore()
        childFixture.store.scope("child").delete(row)
        const childDelete = operations(childFixture.inspect.export())[0]!
        expect(collectionTotals(childDelete.totals)).toMatchObject({
            collectionEffectiveDeltasPrepared: 0,
            collectionRowSourcesChanged: 0,
            collectionMembershipSourcesChanged: 0,
            collectionOwnerRetentionSetsCreated: 1,
            collectionOwnerRetains: 1,
            collectionOwnerReleases: 0,
        })
    })

    test("makes direct delete an operation and emits canonical intents only for commits", () => {
        const sessions = collection<string, number>()
        const row = sessions("a")
        const { store, inspect } = createInspectableStore()
        store.set(row, 1)
        inspect.reset()

        store.delete(row)
        const deleted = inspect.export()
        const deleteOperation = operations(deleted)[0]!
        const deleteCommit = deleted.summaries.find(
            summary => summary.type === "commit",
        )
        expect(deleteOperation).toMatchObject({
            operation: "delete",
            effect: "committed",
            commitId: expect.any(Number),
        })
        expect(deleteCommit).toMatchObject({
            intents: 1,
            commitId: deleteOperation.commitId,
        })
        expect(deleted.details).toContainEqual(
            expect.objectContaining({
                type: "collection-intent",
                intent: "delete",
                operationId: deleteOperation.operationId,
                commitId: deleteOperation.commitId,
            }),
        )

        const abort = new Error("abort without retention")
        inspect.reset()
        expect(
            thrownBy(() =>
                store.txn(transaction => {
                    transaction.set(row, 2)
                    throw abort
                }),
            ),
        ).toBe(abort)
        const aborted = inspect.export()
        expect(operations(aborted)[0]).toMatchObject({
            operation: "transaction",
            result: "threw",
            effect: "none",
        })
        expect(collectionTotals(operations(aborted)[0]!.totals)).toMatchObject({
            collectionRowIntentsStaged: 1,
            collectionRowIntentStorageAllocations: 1,
        })
        expect(
            aborted.details.filter(
                detail => detail.type === "collection-intent",
            ),
        ).toEqual([])
        expect(
            aborted.summaries.some(summary => summary.type === "commit"),
        ).toBe(false)
    })

    for (const detailCapacity of [0, 1]) {
        test(`keeps collection totals exact when detail capacity is ${detailCapacity}`, () => {
            const sessions = collection<string, number>()
            const row = sessions("a")
            const { store, inspect } = createInspectableStore({
                capacity: { details: detailCapacity },
            })
            store.get(row)
            store.get(sessions)
            inspect.reset()

            inspect.span("overflow insert", () => store.set(row, 1))
            const report = inspect.export()
            const wholeOperation = {
                collectionRowIntentsStaged: 1,
                collectionRowIntentStorageAllocations: 1,
                collectionRowFinalResolutionVisits: 1,
                collectionRowRouteVisits: 1,
                collectionMembershipRecordCreations: 0,
                collectionMembershipRouteVisits: 2,
                collectionMembershipRowsScanned: 1,
                collectionMembershipArrayAllocations: 1,
                collectionRowSourcesChanged: 1,
                collectionMembershipSourcesChanged: 1,
                collectionEffectiveDeltasPrepared: 1,
                collectionOwnerRetentionSetsCreated: 1,
                collectionOwnerRetains: 1,
                collectionOwnerReleases: 0,
            } satisfies CollectionTotals
            for (const summary of report.summaries.filter(
                summary => summary.type !== "commit",
            )) {
                expect(collectionTotals(summary.totals)).toEqual(wholeOperation)
            }
            const commit = report.summaries.find(
                summary => summary.type === "commit",
            )!
            expect(collectionTotals(commit.totals)).toEqual({
                ...zeroCollectionTotals(),
                collectionRowSourcesChanged: 1,
                collectionMembershipSourcesChanged: 1,
                collectionEffectiveDeltasPrepared: 1,
                collectionOwnerRetentionSetsCreated: 1,
                collectionOwnerRetains: 1,
            })
            expect(report.details).toHaveLength(detailCapacity)
            expect(report.overflow.details).toBeGreaterThan(0)
            expect(report.complete).toBe(false)
            expect(JSON.parse(JSON.stringify(report))).toEqual(report)
        })
    }

    test("reuses full-cardinality settlement state when detail capacity is zero", () => {
        const sessions = collection<number, number>()
        const rows = Array.from({ length: 1_024 }, (_, index) =>
            sessions(index),
        )
        const { store, inspect } = createInspectableStore({
            capacity: { details: 0 },
        })
        store.get(sessions)
        store.txn(transaction => {
            for (const [index, row] of rows.entries()) {
                transaction.set(row, index)
            }
        })
        inspect.reset()

        store.txn(transaction => {
            for (const row of rows) transaction.delete(row)
        })
        const report = inspect.export()

        expect(report.details).toEqual([])
        expect(report.overflow.details).toBe(2_049)
        expect(collectionTotals(operations(report)[0]!.totals)).toEqual({
            collectionRowIntentsStaged: 1_024,
            collectionRowIntentStorageAllocations: 1,
            collectionRowFinalResolutionVisits: 1_024,
            collectionRowRouteVisits: 0,
            collectionMembershipRecordCreations: 0,
            collectionMembershipRouteVisits: 2,
            collectionMembershipRowsScanned: 2_048,
            collectionMembershipArrayAllocations: 1,
            collectionRowSourcesChanged: 0,
            collectionMembershipSourcesChanged: 1,
            collectionEffectiveDeltasPrepared: 0,
            collectionOwnerRetentionSetsCreated: 0,
            collectionOwnerRetains: 0,
            collectionOwnerReleases: 1_024,
        })
    })

    test("keeps a retained summary exact when the summary ring wraps", () => {
        const sessions = collection<string, number>()
        const row = sessions("a")
        const { store, inspect } = createInspectableStore({
            capacity: { summaries: 1, details: 0 },
        })
        store.get(row)
        store.get(sessions)
        inspect.reset()

        inspect.span("wrapped summaries", () => store.set(row, 1))

        const report = inspect.export()
        expect(report.summaries).toHaveLength(1)
        expect(report.summaries[0]).toMatchObject({
            type: "span",
            name: "wrapped summaries",
        })
        expect(collectionTotals(report.summaries[0]!.totals)).toEqual({
            collectionRowIntentsStaged: 1,
            collectionRowIntentStorageAllocations: 1,
            collectionRowFinalResolutionVisits: 1,
            collectionRowRouteVisits: 1,
            collectionMembershipRecordCreations: 0,
            collectionMembershipRouteVisits: 2,
            collectionMembershipRowsScanned: 1,
            collectionMembershipArrayAllocations: 1,
            collectionRowSourcesChanged: 1,
            collectionMembershipSourcesChanged: 1,
            collectionEffectiveDeltasPrepared: 1,
            collectionOwnerRetentionSetsCreated: 1,
            collectionOwnerRetains: 1,
            collectionOwnerReleases: 0,
        })
        expect(report.overflow.summaries).toBe(2)
        expect(report.complete).toBe(false)
    })

    test("records read materialization totals only inside an explicit span", () => {
        const sessions = collection<string, number>()
        const row = sessions("opaque")
        const { store, inspect } = createInspectableStore()

        expect(store.get(row)).toBeUndefined()
        expect(store.get(sessions)).toEqual([])
        const outside = inspect.export()
        expect(outside.summaries).toEqual([])
        expect(
            outside.details.filter(
                detail =>
                    detail.type === "collection-source" &&
                    detail.action === "materialized",
            ),
        ).toHaveLength(2)

        inspect.reset()
        const child = store.scope("child")
        inspect.span("materialize child", () => {
            expect(child.get(row)).toBeUndefined()
            expect(child.get(sessions)).toEqual([])
        })
        const inside = inspect.export()
        const span = inside.summaries.find(summary => summary.type === "span")!
        expect(collectionTotals(span.totals)).toEqual({
            collectionRowIntentsStaged: 0,
            collectionRowIntentStorageAllocations: 0,
            collectionRowFinalResolutionVisits: 0,
            collectionRowRouteVisits: 2,
            collectionMembershipRecordCreations: 1,
            collectionMembershipRouteVisits: 2,
            collectionMembershipRowsScanned: 0,
            collectionMembershipArrayAllocations: 1,
            collectionRowSourcesChanged: 0,
            collectionMembershipSourcesChanged: 0,
            collectionEffectiveDeltasPrepared: 0,
            collectionOwnerRetentionSetsCreated: 0,
            collectionOwnerRetains: 0,
            collectionOwnerReleases: 0,
        })
        expect(
            inside.details.filter(
                detail =>
                    detail.type === "collection-source" &&
                    detail.action === "materialized" &&
                    detail.spanId === span.spanId,
            ),
        ).toHaveLength(2)

        inspect.reset()
        inspect.span("read cached child", () => {
            child.get(row)
            child.get(sessions)
        })
        const cached = inspect.export().summaries[0]!
        expect(collectionTotals(cached.totals)).toEqual({
            ...zeroCollectionTotals(),
            collectionRowRouteVisits: 1,
            collectionMembershipRouteVisits: 1,
        })
        expect(inspect.export().details).toEqual([])
    })

    test("counts each membership entry examined while producing snapshots", () => {
        const sessions = collection<string, number>()
        const first = sessions("first")
        const second = sessions("second")
        const { store, inspect } = createInspectableStore()
        store.set(first, 1)
        store.set(second, 2)
        const child = store.scope("child")
        inspect.reset()

        inspect.span("copy inherited membership", () => child.get(sessions))
        const copied = inspect.export().summaries[0]!
        expect(collectionTotals(copied.totals)).toEqual({
            ...zeroCollectionTotals(),
            collectionMembershipRecordCreations: 1,
            collectionMembershipRouteVisits: 2,
            collectionMembershipRowsScanned: 2,
            collectionMembershipArrayAllocations: 1,
        })

        inspect.reset()
        child.delete(second)
        const childDelete = operations(inspect.export())[0]!
        expect(collectionTotals(childDelete.totals)).toMatchObject({
            collectionMembershipRouteVisits: 3,
            collectionMembershipRowsScanned: 5,
            collectionMembershipArrayAllocations: 1,
            collectionMembershipSourcesChanged: 1,
        })

        inspect.reset()
        store.delete(first)
        const inheritedDelete = operations(inspect.export())[0]!
        expect(collectionTotals(inheritedDelete.totals)).toMatchObject({
            collectionMembershipRouteVisits: 5,
            collectionMembershipRowsScanned: 6,
            collectionMembershipArrayAllocations: 2,
            collectionMembershipSourcesChanged: 2,
        })

        inspect.reset()
        store.txn(transaction => {
            expect(transaction.get(sessions)).toEqual([second])
            expect(transaction.get(sessions)).toEqual([second])
        })
        const draftReads = operations(inspect.export())[0]!
        expect(collectionTotals(draftReads.totals)).toMatchObject({
            collectionRowIntentsStaged: 0,
            collectionRowIntentStorageAllocations: 0,
            collectionRowFinalResolutionVisits: 0,
            collectionMembershipRouteVisits: 1,
            collectionMembershipRowsScanned: 2,
            collectionMembershipArrayAllocations: 0,
        })

        const memoFixture = createInspectableStore()
        memoFixture.store.txn(transaction => {
            transaction.set(first, 1)
            transaction.set(second, 2)
        })
        const sharedPlan = operations(memoFixture.inspect.export())[0]!
        expect(collectionTotals(sharedPlan.totals)).toMatchObject({
            collectionRowFinalResolutionVisits: 2,
            collectionMembershipRecordCreations: 1,
            collectionMembershipRouteVisits: 2,
            collectionMembershipArrayAllocations: 1,
        })
    })

    test("keeps a cold row unmaterialized during ownership work", () => {
        const sessions = collection<string, number>()
        const row = sessions("cold")
        const { store, inspect } = createInspectableStore()

        store.set(row, 1)

        const report = inspect.export()
        const operation = operations(report)[0]!
        expect(collectionTotals(operation.totals)).toEqual({
            collectionRowIntentsStaged: 1,
            collectionRowIntentStorageAllocations: 1,
            collectionRowFinalResolutionVisits: 1,
            collectionRowRouteVisits: 0,
            collectionMembershipRecordCreations: 1,
            collectionMembershipRouteVisits: 2,
            collectionMembershipRowsScanned: 1,
            collectionMembershipArrayAllocations: 1,
            collectionRowSourcesChanged: 0,
            collectionMembershipSourcesChanged: 0,
            collectionEffectiveDeltasPrepared: 0,
            collectionOwnerRetentionSetsCreated: 1,
            collectionOwnerRetains: 1,
            collectionOwnerReleases: 0,
        })
        expect(report.details).toEqual([
            expect.objectContaining({
                type: "collection-intent",
                intent: "set",
            }),
            expect.objectContaining({
                type: "collection-source",
                source: "membership",
                action: "materialized",
            }),
        ])
        expect(
            report.details.some(
                detail =>
                    detail.type === "collection-effective-delta" ||
                    (detail.type === "collection-source" &&
                        detail.source === "row"),
            ),
        ).toBe(false)

        const childFixture = createInspectableStore()
        const child = childFixture.store.scope("child")
        child.set(row, 2)
        const childOperation = operations(childFixture.inspect.export())[0]!
        expect(collectionTotals(childOperation.totals)).toMatchObject({
            collectionRowRouteVisits: 0,
            collectionMembershipRecordCreations: 2,
            collectionMembershipRouteVisits: 3,
            collectionMembershipRowsScanned: 1,
            collectionMembershipArrayAllocations: 2,
            collectionRowSourcesChanged: 0,
            collectionMembershipSourcesChanged: 0,
            collectionEffectiveDeltasPrepared: 0,
            collectionOwnerRetentionSetsCreated: 1,
            collectionOwnerRetains: 1,
        })
    })

    test("releases every retained owner exactly once on disposal", () => {
        const sessions = collection<string, number>()
        const rows = ["a", "b", "c", "d"].map(key => sessions(key))
        const { store, inspect } = createInspectableStore()
        const child = store.scope("child")
        for (const [index, row] of rows.entries()) child.set(row, index)
        inspect.reset()

        inspect.span("dispose child", () => child.dispose())
        const disposed = inspect.export()
        expect(disposed.details).toEqual([])
        expect(collectionTotals(disposed.summaries[0]!.totals)).toEqual({
            ...zeroCollectionTotals(),
            collectionOwnerReleases: 4,
        })

        inspect.reset()
        inspect.span("dispose child again", () => child.dispose())
        expect(collectionTotals(inspect.export().summaries[0]!.totals)).toEqual(
            zeroCollectionTotals(),
        )
    })

    test("never exports row keys, values, updater errors, or callbacks", () => {
        const secretKey = "PRIVATE_COLLECTION_KEY_9f17"
        const secretValue = "PRIVATE_COLLECTION_VALUE_1a62"
        const secretError = "PRIVATE_COLLECTION_ERROR_30de"
        const secretCallback = "PRIVATE_COLLECTION_CALLBACK_741c"
        const sessions = collection<string, { secret: string }>()
        const row = sessions(secretKey)
        const { store, inspect } = createInspectableStore()
        const callback = Object.assign(() => undefined, {
            marker: secretCallback,
        })
        const unsubscribe = store.sub(row, callback)

        store.set(row, { secret: secretValue })
        expect(
            thrownBy(() =>
                store.update(row, () => {
                    throw new Error(secretError)
                }),
            ),
        ).toBeInstanceOf(Error)
        unsubscribe()

        const encoded = JSON.stringify(inspect.export())
        for (const secret of [
            secretKey,
            secretValue,
            secretError,
            secretCallback,
        ]) {
            expect(encoded).not.toContain(secret)
        }
    })

    test("delivers presence after native row and membership sources with an exact error ledger", () => {
        const sessions = collection<string, number>()
        const row = sessions("a")
        const rowPresence = presence(row)
        const { store } = createInspectableStore()
        const attempted: string[] = []
        const failures = {
            row: new Error("row"),
            membership: new Error("membership"),
            presence: new Error("presence"),
        }

        store.sub(rowPresence, () => {
            attempted.push("presence")
            expect(store.get(rowPresence)).toBe(true)
            throw failures.presence
        })
        store.sub(sessions, () => {
            attempted.push("membership")
            expect(store.get(sessions)).toEqual([row])
            throw failures.membership
        })
        store.sub(row, () => {
            attempted.push("row")
            expect(store.get(row)).toBe(1)
            throw failures.row
        })

        const error = thrownBy(() => store.set(row, 1))
        expect(error).toBeInstanceOf(SubscriberNotificationError)
        expect(attempted).toEqual(["row", "membership", "presence"])
        expect(error).toMatchObject({
            cause: failures.row,
            causes: [failures.row, failures.membership, failures.presence],
        })
    })
})
