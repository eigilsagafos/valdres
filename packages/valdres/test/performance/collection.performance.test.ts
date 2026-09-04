import { describe, expect, test } from "bun:test"
import { atom, collection } from "../../src/v1"
import { createInspectableStore } from "../../src/inspect"
import {
    createCommittedStoreTreeDomain,
    createInternalStoreTreeInstrumentation,
    getCollectionKernel,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import { createCollectionDefinition } from "../../src/v1-internal/collection"
import type { CollectionDraftKernel } from "../../src/v1-internal/collection-kernel"
import type {
    InspectionExport,
    InspectionSummary,
    InspectionWorkTotals,
} from "../../src/v1-internal/inspection"

const COLLECTION_COUNTERS = [
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

const operations = (report: InspectionExport): readonly InspectionSummary[] =>
    report.summaries.filter(summary => summary.type === "operation")

const collectionTotals = (
    summary: InspectionSummary,
): Record<(typeof COLLECTION_COUNTERS)[number], number> =>
    Object.fromEntries(
        COLLECTION_COUNTERS.map(counter => [counter, summary.totals[counter]]),
    ) as Record<(typeof COLLECTION_COUNTERS)[number], number>

const expectedCollectionTotals = (
    overrides: Partial<
        Record<(typeof COLLECTION_COUNTERS)[number], number>
    > = {},
): Record<(typeof COLLECTION_COUNTERS)[number], number> =>
    ({
        ...Object.fromEntries(COLLECTION_COUNTERS.map(counter => [counter, 0])),
        ...overrides,
    }) as Record<(typeof COLLECTION_COUNTERS)[number], number>

const expectZeroCollectionWork = (summary: InspectionSummary): void => {
    expect(collectionTotals(summary)).toEqual(expectedCollectionTotals())
}

describe("collection architecture performance gates", () => {
    test("keeps the installed collection vtable off fresh Atom-only work", () => {
        const domain = createCommittedStoreTreeDomain()
        createCollectionDefinition<number, number>(domain)
        const kernel = getCollectionKernel(domain) as CollectionDraftKernel
        const finishRebuild = kernel.beginMembershipRebuildTraceForTest()
        const finishPlacement = kernel.beginMembershipPlacementTraceForTest()
        const target = domain.createStoreTree()
        const count = domain.atom(0)

        target.set(count, 1)
        target.txn(transaction => transaction.set(count, 2))

        expect(finishRebuild()).toEqual([])
        expect(finishPlacement()).toEqual({ coordinates: 0, states: 0 })

        // The public domain has its vtable installed by collection(), while
        // this fresh inspectable Store records the exact production work codes.
        collection<number, number>()
        const inspected = createInspectableStore({
            capacity: { summaries: 8, details: 0 },
        })
        const value = atom(0)
        inspected.store.set(value, 1)
        inspected.store.txn(transaction => transaction.set(value, 2))
        const atomOperations = operations(inspected.inspect.export())
        expect(atomOperations).toHaveLength(2)
        for (const operation of atomOperations) {
            expectZeroCollectionWork(operation)
        }
    })

    test("keeps direct and encoded row lookup identity stable at 1k/5k/20k", () => {
        for (const cardinality of [1_000, 5_000, 20_000]) {
            const direct = collection<number, number>()
            const directRows = Array.from({ length: cardinality }, (_, index) =>
                direct(index),
            )
            for (let index = 0; index < cardinality; index++) {
                expect(direct(index)).toBe(directRows[index])
            }
            const missing = direct(cardinality)
            expect(missing).toBe(direct(cardinality))
            expect(missing).not.toBe(directRows[cardinality - 1])

            const encoded = collection<
                string,
                number,
                Readonly<{ id: string; payload: number }>
            >({ encodeKey: input => input.id })
            const encodedRows = Array.from(
                { length: cardinality },
                (_, index) => encoded({ id: String(index), payload: index }),
            )
            for (let index = 0; index < cardinality; index++) {
                expect(encoded({ id: String(index), payload: -1 })).toBe(
                    encodedRows[index],
                )
            }
        }
    }, 30_000)

    test("bounds membership work across 1k/5k/20k rows", () => {
        for (const cardinality of [1_000, 5_000, 20_000]) {
            const rows = collection<number, number>()
            const handles = Array.from({ length: cardinality }, (_, index) =>
                rows(index),
            )
            const { store, inspect } = createInspectableStore({
                capacity: { summaries: 8, details: 0 },
            })
            store.txn(transaction => {
                for (const [index, row] of handles.entries()) {
                    transaction.set(row, index)
                }
            })
            expect(store.get(rows)).toHaveLength(cardinality)

            inspect.reset()
            const middle = handles[Math.floor(cardinality / 2)]!
            store.update(middle, current => current + 1)
            const updated = collectionTotals(operations(inspect.export())[0]!)
            expect(updated).toEqual(
                expectedCollectionTotals({
                    collectionRowIntentsStaged: 1,
                    collectionRowIntentStorageAllocations: 1,
                    collectionRowFinalResolutionVisits: 1,
                }),
            )

            inspect.reset()
            store.update(middle, current => current)
            expectZeroCollectionWork(operations(inspect.export())[0]!)

            inspect.reset()
            store.txn(transaction => {
                const first = transaction.get(rows)
                expect(transaction.get(rows)).toBe(first)
            })
            const overlay = collectionTotals(operations(inspect.export())[0]!)
            expect(overlay).toEqual(
                expectedCollectionTotals({
                    collectionMembershipRouteVisits: 1,
                    collectionMembershipRowsScanned: cardinality * 2,
                }),
            )

            const inserted = rows(cardinality)
            inspect.reset()
            store.set(inserted, cardinality)
            const insertionReport = inspect.export()
            const insertion = collectionTotals(operations(insertionReport)[0]!)
            expect(insertion).toEqual(
                expectedCollectionTotals({
                    collectionRowIntentsStaged: 1,
                    collectionRowIntentStorageAllocations: 1,
                    collectionRowFinalResolutionVisits: 1,
                    collectionMembershipRouteVisits: 2,
                    collectionMembershipRowsScanned: cardinality + 1,
                    collectionMembershipArrayAllocations: 1,
                    collectionMembershipSourcesChanged: 1,
                    collectionOwnerRetains: 1,
                }),
            )
            expect(insertionReport.overflow.details).toBe(3)

            inspect.reset()
            store.delete(inserted)
            const deletionReport = inspect.export()
            const deletion = collectionTotals(operations(deletionReport)[0]!)
            expect(deletion).toEqual(
                expectedCollectionTotals({
                    collectionRowIntentsStaged: 1,
                    collectionRowIntentStorageAllocations: 1,
                    collectionRowFinalResolutionVisits: 1,
                    collectionMembershipRouteVisits: 2,
                    collectionMembershipRowsScanned: cardinality + 2,
                    collectionMembershipArrayAllocations: 1,
                    collectionMembershipSourcesChanged: 1,
                    collectionOwnerReleases: 1,
                }),
            )
            expect(deletionReport.overflow.details).toBe(3)
            expect(store.get(rows)).toHaveLength(cardinality)
            store.dispose()
        }
    }, 120_000)

    test("localizes a cold inherited update without collection-sized work", () => {
        for (const cardinality of [1_000, 5_000, 20_000]) {
            const rows = collection<number, number>()
            const handles = Array.from({ length: cardinality }, (_, index) =>
                rows(index),
            )
            const { store, inspect } = createInspectableStore({
                capacity: { summaries: 8, details: 0 },
            })
            store.txn(transaction => {
                for (const [index, row] of handles.entries()) {
                    transaction.set(row, index)
                }
            })
            const rootRows = store.get(rows)
            const child = store.scope("cold-child")

            inspect.reset()
            const middle = handles[Math.floor(cardinality / 2)]!
            child.update(middle, current => current + 1)
            expect(collectionTotals(operations(inspect.export())[0]!)).toEqual(
                expectedCollectionTotals({
                    collectionRowIntentsStaged: 1,
                    collectionRowIntentStorageAllocations: 1,
                    collectionRowFinalResolutionVisits: 1,
                    collectionMembershipRecordCreations: 1,
                    collectionMembershipRouteVisits: 2,
                    collectionOwnerRetentionSetsCreated: 1,
                    collectionOwnerRetains: 1,
                }),
            )

            const childRows = child.get(rows)
            expect(childRows).toEqual(rootRows)
            expect(childRows).not.toBe(rootRows)
            expect(child.get(rows)).toBe(childRows)
            child.dispose()
            store.dispose()
        }
    }, 120_000)

    test("an absent row read creates no membership record or owner pin", () => {
        const rows = collection<string, number>()
        const row = rows("absent")
        const { store, inspect } = createInspectableStore({
            capacity: { summaries: 4, details: 0 },
        })

        inspect.span("absent row read", () => {
            expect(store.get(row)).toBeUndefined()
        })
        const totals = collectionTotals(inspect.export().summaries[0]!)
        expect(totals).toEqual(
            expectedCollectionTotals({ collectionRowRouteVisits: 1 }),
        )
    })

    test("a one-leaf change below 20k materialized siblings visits no unrelated route", () => {
        const instrumentation = createInternalStoreTreeInstrumentation()
        const domain = createCommittedStoreTreeDomain(instrumentation)
        const rows = createCollectionDefinition<string, number>(domain)
        const row = rows("leaf")
        const root = domain.createStoreTree()
        const scopes = Array.from({ length: 20_000 }, () => root.scope())
        for (const scope of scopes) scope.get(rows)
        const routeVisits = instrumentation.read("routeVisits")
        const changed = scopes.at(-1)!

        changed.set(row, 1)

        expect(instrumentation.read("routeVisits")).toBe(routeVisits)
        expect(scopes[0]!.get(rows)).toEqual([])
        expect(changed.get(rows)).toEqual([row])
        root.dispose()
    }, 30_000)

    test("1,024 membership levels use one coordinate and linear placement state", () => {
        const depth = 1_024
        const domain = createCommittedStoreTreeDomain()
        const rows = createCollectionDefinition<string, number>(domain)
        const row = rows("deep")
        const root = domain.createStoreTree()
        let deepest = root
        for (let level = 0; level < depth; level++) deepest = deepest.scope()
        deepest.get(rows)
        const kernel = getCollectionKernel(domain) as CollectionDraftKernel

        for (const operation of ["set", "delete"] as const) {
            const finishRebuild = kernel.beginMembershipRebuildTraceForTest()
            const finishPlacement =
                kernel.beginMembershipPlacementTraceForTest()
            if (operation === "set") root.set(row, 1)
            else root.delete(row)
            const rebuilds = finishRebuild()
            expect(rebuilds).toHaveLength(depth + 1)
            expect(new Set(rebuilds).size).toBe(depth + 1)
            expect(finishPlacement()).toEqual({
                coordinates: 1,
                states: depth + 1,
            })
        }
        root.dispose()
    }, 30_000)
})
