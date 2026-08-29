import { describe, expect, test } from "bun:test"
import {
    ExperimentalIndexOperationDomain,
    ExperimentalIndexOperations,
    ManualScheduler,
} from "./index"
import { CollectionFixture, deltasFor, stringProjector } from "./test-fixture"
import type { OperationStatus, PreparedCollectionCommit } from "./types"

describe("experimental collection index operations", () => {
    test("V1I-OPS-001 deduplicates concurrent demand onto one build and wakeable", () => {
        const fixture = new CollectionFixture()
        fixture.set("root", "a", "A")
        fixture.set("root", "b", "B")
        const checkpoint = fixture.checkpoint("root")
        const scheduler = new ManualScheduler()
        const operations = new ExperimentalIndexOperations(
            fixture.definition("root"),
            scheduler,
        )

        const first = operations.demand(checkpoint)
        const second = operations.demand(checkpoint)
        if (first.state !== "building" || second.state !== "building") {
            throw new Error("Expected both demands to be building")
        }
        expect(second.wakeable).toBe(first.wakeable)
        expect(first.wakeable.inspect()).toEqual({ state: "pending" })
        expect(
            operations.events().filter(event => event.kind === "build-started"),
        ).toHaveLength(1)
        expect(operations.snapshot()).toBeUndefined()

        const settled: number[] = []
        first.wakeable.then(snapshot => settled.push(snapshot.buckets.length))
        scheduler.runAll()

        const snapshot = operations.snapshot()
        if (snapshot === undefined) throw new Error("Expected publication")
        expect(snapshot.buckets).toEqual([
            { key: "A", rows: ["a"] },
            { key: "B", rows: ["b"] },
        ])
        expect(first.wakeable.inspect()).toEqual({
            state: "fulfilled",
            snapshot,
        })
        expect(settled).toEqual([2])
        expect(operations.status()).toMatchObject({
            state: "ready",
            throughEpoch: checkpoint.epoch,
            progress: { completed: 2, total: 2 },
        })
        assertMonotonic(operations.statusHistory())
    })

    test("V1I-OPS-002 journals prepared deltas and publishes one reconciled snapshot atomically", () => {
        const fixture = new CollectionFixture()
        fixture.set("root", "a", "A")
        fixture.set("root", "b", "B")
        let operationalProjectCalls = 0
        const definition = fixture.definition("root", (row, token) => {
            operationalProjectCalls += 1
            return stringProjector(row, token)
        })
        const checkpoint = fixture.checkpoint("root")
        const scheduler = new ManualScheduler()
        const operations = new ExperimentalIndexOperations(
            definition,
            scheduler,
        )

        operations.demand(checkpoint)
        scheduler.runNext()
        expect(operations.status()).toMatchObject({
            state: "building",
            progress: { completed: 1, total: 2 },
        })

        const rawCommits = [
            fixture.set("root", "c", "C"),
            fixture.set("root", "a", "A2"),
            fixture.remove("root", "b"),
        ]
        const prepared = rawCommits.map(commit =>
            fixture.prepare(commit, definition, stringProjector),
        )
        const callsBeforeRecord = operationalProjectCalls
        for (const commit of prepared) operations.recordCommit(commit)
        expect(operationalProjectCalls).toBe(callsBeforeRecord)

        expect(operations.snapshot()).toBeUndefined()
        scheduler.runAll()
        expect(operationalProjectCalls).toBe(callsBeforeRecord + 1)
        expect(operations.snapshot()).toMatchObject({
            buckets: [
                { key: "A2", rows: ["a"] },
                { key: "C", rows: ["c"] },
            ],
        })
        expect(operations.status()).toMatchObject({
            state: "ready",
            throughEpoch: prepared.at(-1)!.epoch,
        })
        expect(
            operations.events().filter(event => event.kind === "published"),
        ).toEqual([
            {
                kind: "published",
                generation: 1,
                throughEpoch: prepared.at(-1)!.epoch,
                source: "build",
            },
        ])
        assertMonotonic(operations.statusHistory())
    })

    test("V1I-OPS-003 imports portable and older artifacts without extractor re-entry", () => {
        const fixture = new CollectionFixture()
        fixture.set("root", "a", "A")
        fixture.set("root", "b", "B")
        fixture.createChild()
        const rootBase = fixture.checkpoint("root")
        const childBase = fixture.checkpoint("child")
        expect(childBase.logicalCheckpoint).toBe(rootBase.logicalCheckpoint)

        let exportProjectCalls = 0
        const rootDefinition = fixture.definition("root", (row, token) => {
            exportProjectCalls += 1
            return stringProjector(row, token)
        })
        const sourceScheduler = new ManualScheduler()
        const source = new ExperimentalIndexOperations(
            rootDefinition,
            sourceScheduler,
        )
        source.demand(rootBase)
        sourceScheduler.runAll()
        expect(exportProjectCalls).toBe(2)
        exportProjectCalls = 0
        const artifact = source.exportArtifact(rootBase)
        expect(exportProjectCalls).toBe(0)
        expect(artifact).not.toHaveProperty("tree")
        expect(artifact).not.toHaveProperty("scope")

        let importProjectCalls = 0
        const childDefinition = fixture.definition("child", () => {
            importProjectCalls += 1
            throw new Error("artifact import must not project")
        })
        const childBaseOverlay = fixture.prepareScopeOverlay(
            artifact,
            childBase,
            childDefinition,
            stringProjector,
        )
        const portable = new ExperimentalIndexOperations(
            childDefinition,
            new ManualScheduler(),
        )
        expect(
            portable.importArtifact({
                artifact,
                baseCheckpoint: childBase,
                baseOverlay: childBaseOverlay,
                laterCommits: [],
                targetCheckpoint: childBase,
            }),
        ).toMatchObject({
            ok: true,
            snapshot: {
                tree: "tree",
                scope: "child",
                buckets: source.snapshot()?.buckets,
            },
        })
        expect(importProjectCalls).toBe(0)

        const laterRaw = fixture.set("root", "c", "C")
        const laterPrepared = fixture.prepare(
            laterRaw,
            childDefinition,
            stringProjector,
        )
        const childCurrent = fixture.checkpoint("child")
        const reconciled = new ExperimentalIndexOperations(
            childDefinition,
            new ManualScheduler(),
        )
        expect(
            reconciled.importArtifact({
                artifact,
                baseCheckpoint: childBase,
                baseOverlay: childBaseOverlay,
                laterCommits: [laterPrepared],
                targetCheckpoint: childCurrent,
            }),
        ).toMatchObject({
            ok: true,
            snapshot: {
                scope: "child",
                buckets: [
                    { key: "A", rows: ["a"] },
                    { key: "B", rows: ["b"] },
                    { key: "C", rows: ["c"] },
                ],
            },
        })
        expect(importProjectCalls).toBe(0)
        expect(reconciled.status()).toMatchObject({
            state: "ready",
            throughEpoch: childCurrent.epoch,
        })

        const stale = new ExperimentalIndexOperations(
            childDefinition,
            new ManualScheduler(),
        )
        expect(
            stale.importArtifact({
                artifact,
                baseCheckpoint: childCurrent,
                baseOverlay: childBaseOverlay,
                laterCommits: [],
                targetCheckpoint: childCurrent,
            }),
        ).toEqual({ ok: false, error: "STALE_ARTIFACT" })
        expect(stale.snapshot()).toBeUndefined()

        const corrupt = new ExperimentalIndexOperations(
            childDefinition,
            new ManualScheduler(),
        )
        expect(
            corrupt.importArtifact({
                artifact: Object.freeze({
                    ...artifact,
                    checksum: "00000000",
                }),
                baseCheckpoint: childBase,
                baseOverlay: childBaseOverlay,
                laterCommits: [],
                targetCheckpoint: childBase,
            }),
        ).toEqual({ ok: false, error: "CORRUPT_ARTIFACT" })
        expect(corrupt.snapshot()).toBeUndefined()
        expect(importProjectCalls).toBe(0)
    })

    test("V1I-OPS-004 supports scan failure, cancellation, retry, and terminal disposal", () => {
        const fixture = new CollectionFixture()
        fixture.set("root", "a", "good")
        fixture.set("root", "b", "boom")
        const scheduler = new ManualScheduler()
        const definition = fixture.definition("root", (_row, token) => {
            if (token.kind !== "string") throw new Error("not a string")
            if (token.value === "boom") throw new Error("projector exploded")
            return token.value
        })
        const operations = new ExperimentalIndexOperations(
            definition,
            scheduler,
        )
        const failedDemand = operations.demand(fixture.checkpoint("root"))
        if (failedDemand.state !== "building") {
            throw new Error("Expected a building demand")
        }
        scheduler.runAll()
        expect(operations.status()).toMatchObject({
            state: "failed",
            generation: 1,
            progress: { completed: 1, total: 2 },
            code: "BUILD_FAILED",
            message: "Index projector failed",
        })
        expect(failedDemand.wakeable.inspect()).toEqual({
            state: "rejected",
            reason: "BUILD_FAILED",
        })
        expect(operations.snapshot()).toBeUndefined()

        fixture.set("root", "b", "recovered")
        operations.retry(fixture.checkpoint("root"))
        scheduler.runAll()
        expect(operations.status()).toMatchObject({
            state: "ready",
            generation: 2,
        })
        expect(operations.snapshot()?.buckets).toEqual([
            { key: "good", rows: ["a"] },
            { key: "recovered", rows: ["b"] },
        ])
        assertMonotonic(operations.statusHistory())

        const cancelScheduler = new ManualScheduler()
        const cancellable = new ExperimentalIndexOperations(
            definition,
            cancelScheduler,
        )
        const cancelledDemand = cancellable.demand(fixture.checkpoint("root"))
        if (cancelledDemand.state !== "building") {
            throw new Error("Expected a building demand")
        }
        cancelScheduler.runNext()
        cancellable.cancel("caller-cancelled")
        cancelScheduler.runAll()
        expect(cancelledDemand.wakeable.inspect()).toEqual({
            state: "rejected",
            reason: "caller-cancelled",
        })
        expect(cancellable.status()).toMatchObject({
            state: "cancelled",
            reason: "caller-cancelled",
        })
        cancellable.retry(fixture.checkpoint("root"))
        cancelScheduler.runAll()
        expect(cancellable.status().state).toBe("ready")

        const disposeScheduler = new ManualScheduler()
        const disposable = new ExperimentalIndexOperations(
            definition,
            disposeScheduler,
        )
        disposable.demand(fixture.checkpoint("root"))
        disposable.dispose()
        disposeScheduler.runAll()
        expect(disposable.status()).toMatchObject({
            state: "cancelled",
            reason: "disposed",
        })
        expect(() => disposable.retry(fixture.checkpoint("root"))).toThrow(
            "disposed",
        )
    })

    test("V1I-OPS-005 consumes root and child effective deltas across tombstones and overrides", () => {
        const fixture = new CollectionFixture()
        fixture.set("root", "a", "root-A")
        fixture.set("root", "b", "root-B")
        fixture.createChild()
        fixture.remove("child", "a")
        fixture.set("child", "b", "child-B")

        const scheduler = new ManualScheduler()
        const rootDefinition = fixture.definition("root")
        const childDefinition = fixture.definition("child")
        const root = new ExperimentalIndexOperations(rootDefinition, scheduler)
        const child = new ExperimentalIndexOperations(
            childDefinition,
            scheduler,
        )
        root.demand(fixture.checkpoint("root"))
        child.demand(fixture.checkpoint("child"))

        const rawCommits = [
            fixture.set("root", "a", "root-A2"),
            fixture.set("root", "b", "root-B2"),
            fixture.reset("child", "a"),
            fixture.reset("child", "b"),
        ]
        const [rootA, rootB, childAReset, childBReset] = rawCommits
        expect(deltasFor(rootA!, "child")).toEqual([])
        expect(deltasFor(rootB!, "child")).toEqual([])
        expect(deltasFor(childAReset!, "child")).toMatchObject([
            { row: "a", membership: "insert", after: { kind: "present" } },
        ])
        expect(deltasFor(childBReset!, "child")).toMatchObject([
            { row: "b", membership: "unchanged", after: { kind: "present" } },
        ])

        for (const raw of rawCommits) {
            const prepared = fixture.prepare(raw, rootDefinition)
            root.recordCommit(prepared)
            child.recordCommit(prepared)
        }
        scheduler.runAll()

        expect(root.snapshot()?.buckets).toEqual([
            { key: "root-A2", rows: ["a"] },
            { key: "root-B2", rows: ["b"] },
        ])
        expect(child.snapshot()?.buckets).toEqual([
            { key: "root-A2", rows: ["a"] },
            { key: "root-B2", rows: ["b"] },
        ])
    })

    test("V1I-OPS-006 orders final inserts by birth sequence, not raw delta order", () => {
        const fixture = new CollectionFixture(["a", "b"])
        const definition = fixture.definition("root", () => "group")
        const scheduler = new ManualScheduler()
        const operations = new ExperimentalIndexOperations(
            definition,
            scheduler,
        )
        operations.demand(fixture.checkpoint("root"))

        const raw = fixture.transactSet("root", [
            { row: "a", label: "A1" },
            { row: "b", label: "B" },
            { row: "a", label: "A2" },
        ])
        const prepared = fixture.prepare(raw, definition)
        expect(
            prepared.deltas.map(delta => [delta.row, delta.birthSequence]),
        ).toEqual([
            ["a", 3],
            ["b", 2],
        ])
        const reversed: PreparedCollectionCommit = Object.freeze({
            ...prepared,
            deltas: Object.freeze([...prepared.deltas].reverse()),
        })
        operations.recordCommit(reversed)
        scheduler.runAll()

        expect(operations.snapshot()?.buckets).toEqual([
            { key: "group", rows: ["b", "a"] },
        ])
    })

    test("V1I-OPS-007 consumes zero-relevant epochs without republishing content", () => {
        const fixture = new CollectionFixture(["a"])
        fixture.set("root", "a", "root-A")
        fixture.createChild()
        const definition = fixture.definition("root")
        const scheduler = new ManualScheduler()
        const operations = new ExperimentalIndexOperations(
            definition,
            scheduler,
        )
        operations.demand(fixture.checkpoint("root"))
        scheduler.runAll()
        const initial = operations.snapshot()
        if (initial === undefined) throw new Error("Expected initial snapshot")

        const childOnly = fixture.prepare(
            fixture.set("child", "a", "child-A"),
            definition,
        )
        expect(deltasFor(childOnly, "root")).toEqual([])
        operations.recordCommit(childOnly)
        expect(operations.snapshot()).toBe(initial)
        expect(operations.status()).toMatchObject({
            state: "ready",
            throughEpoch: childOnly.epoch,
        })
        expect(
            operations.events().filter(event => event.kind === "published"),
        ).toHaveLength(1)

        const rootChange = fixture.prepare(
            fixture.set("root", "a", "root-A2"),
            definition,
        )
        operations.recordCommit(rootChange)
        expect(operations.status().state).toBe("ready")
        expect(operations.snapshot()).not.toBe(initial)
        expect(operations.snapshot()?.buckets).toEqual([
            { key: "root-A2", rows: ["a"] },
        ])
    })

    test("V1I-OPS-008 settles terminal state before all-running wakeable listeners", () => {
        const fixture = new CollectionFixture(["a"])
        fixture.set("root", "a", "A")
        const checkpoint = fixture.checkpoint("root")
        const definition = fixture.definition("root")

        const cancelScheduler = new ManualScheduler()
        const cancellable = new ExperimentalIndexOperations(
            definition,
            cancelScheduler,
        )
        const cancelDemand = cancellable.demand(checkpoint)
        if (cancelDemand.state !== "building") throw new Error("building")
        let cancelObserved = ""
        cancelDemand.wakeable.then(undefined, () => {
            cancelObserved = cancellable.status().state
            expect(() => cancellable.demand(checkpoint)).toThrow("retry")
        })
        cancellable.cancel("stop")
        expect(cancelObserved).toBe("cancelled")
        expect(
            cancellable
                .events()
                .filter(event => event.kind === "build-started"),
        ).toHaveLength(1)

        const disposeScheduler = new ManualScheduler()
        const disposable = new ExperimentalIndexOperations(
            definition,
            disposeScheduler,
        )
        const disposeDemand = disposable.demand(checkpoint)
        if (disposeDemand.state !== "building") throw new Error("building")
        let disposeObserved = ""
        let disposeDemandError = ""
        disposeDemand.wakeable.then(undefined, () => {
            disposeObserved = disposable.status().state
            try {
                disposable.demand(checkpoint)
            } catch (error) {
                disposeDemandError =
                    error instanceof Error ? error.message : String(error)
            }
        })
        disposable.dispose()
        expect(disposeObserved).toBe("cancelled")
        expect(disposeDemandError).toContain("disposed")

        const fulfillScheduler = new ManualScheduler()
        const fulfill = new ExperimentalIndexOperations(
            definition,
            fulfillScheduler,
        )
        const fulfillDemand = fulfill.demand(checkpoint)
        if (fulfillDemand.state !== "building") throw new Error("building")
        let fulfilledSecond = 0
        fulfillDemand.wakeable.then(() => {
            throw new Error("first-fulfilled-listener")
        })
        fulfillDemand.wakeable.then(() => {
            fulfilledSecond += 1
        })
        expect(() => fulfillScheduler.runAll()).toThrow(
            "first-fulfilled-listener",
        )
        expect(fulfilledSecond).toBe(1)
        expect(fulfill.status().state).toBe("ready")
        expect(fulfillDemand.wakeable.inspect().state).toBe("fulfilled")

        const rejectScheduler = new ManualScheduler()
        const reject = new ExperimentalIndexOperations(
            definition,
            rejectScheduler,
        )
        const rejectDemand = reject.demand(checkpoint)
        if (rejectDemand.state !== "building") throw new Error("building")
        let rejectedSecond = 0
        rejectDemand.wakeable.then(undefined, () => {
            throw new Error("first-rejected-listener")
        })
        rejectDemand.wakeable.then(undefined, () => {
            rejectedSecond += 1
            throw new Error("second-rejected-listener")
        })
        expect(() => reject.cancel("stop")).toThrow("first-rejected-listener")
        expect(rejectedSecond).toBe(1)
        expect(reject.status().state).toBe("cancelled")
        expect(rejectDemand.wakeable.inspect()).toEqual({
            state: "rejected",
            reason: "stop",
        })
    })

    test("V1I-OPS-009 artifact import cannot roll a ready instance backward", () => {
        const fixture = new CollectionFixture(["a"])
        fixture.set("root", "a", "A")
        const definition = fixture.definition("root")
        const epochOne = fixture.checkpoint("root")
        const scheduler = new ManualScheduler()
        const operations = new ExperimentalIndexOperations(
            definition,
            scheduler,
        )
        operations.demand(epochOne)
        scheduler.runAll()
        const artifact = operations.exportArtifact(epochOne)
        const baseOverlay = fixture.prepareScopeOverlay(
            artifact,
            epochOne,
            definition,
        )

        const update = fixture.prepare(
            fixture.set("root", "a", "A2"),
            definition,
        )
        const epochTwo = fixture.checkpoint("root")
        operations.recordCommit(update)
        const current = operations.snapshot()
        if (current === undefined) throw new Error("Expected ready snapshot")
        expect(current.buckets).toEqual([{ key: "A2", rows: ["a"] }])
        const publishedBeforeImport = operations
            .events()
            .filter(event => event.kind === "published").length

        expect(
            operations.importArtifact({
                artifact,
                baseCheckpoint: epochOne,
                baseOverlay,
                laterCommits: [],
                targetCheckpoint: epochOne,
            }),
        ).toEqual({ ok: false, error: "STALE_ARTIFACT" })
        expect(operations.snapshot()).toBe(current)
        expect(operations.status()).toMatchObject({
            state: "ready",
            throughEpoch: epochTwo.epoch,
        })

        expect(
            operations.importArtifact({
                artifact,
                baseCheckpoint: epochOne,
                baseOverlay,
                laterCommits: [update],
                targetCheckpoint: epochTwo,
            }),
        ).toEqual({ ok: true, snapshot: current })
        expect(operations.snapshot()).toBe(current)
        expect(
            operations.events().filter(event => event.kind === "published"),
        ).toHaveLength(publishedBeforeImport)
    })

    test("V1I-OPS-010 retry cannot discard an epoch consumed before cancellation", () => {
        const fixture = new CollectionFixture(["a"])
        fixture.set("root", "a", "A")
        const definition = fixture.definition("root")
        const epochOne = fixture.checkpoint("root")
        const scheduler = new ManualScheduler()
        const operations = new ExperimentalIndexOperations(
            definition,
            scheduler,
        )
        operations.demand(epochOne)

        const epochTwoCommit = fixture.prepare(
            fixture.set("root", "a", "A2"),
            definition,
        )
        operations.recordCommit(epochTwoCommit)
        operations.cancel("pause")
        expect(operations.status()).toMatchObject({
            state: "cancelled",
            throughEpoch: epochTwoCommit.epoch,
        })
        expect(() => operations.retry(epochOne)).toThrow(
            "older than consumed epoch",
        )
        expect(
            operations.events().filter(event => event.kind === "build-started"),
        ).toHaveLength(1)

        const epochTwo = fixture.checkpoint("root")
        operations.retry(epochTwo)
        scheduler.runAll()
        expect(operations.status()).toMatchObject({
            state: "ready",
            throughEpoch: epochTwo.epoch,
        })
        expect(operations.snapshot()?.buckets).toEqual([
            { key: "A2", rows: ["a"] },
        ])
    })

    test("V1I-OPS-011 enforces one consumed-epoch floor after cancellation, apply failure, and rejected import", () => {
        const fixture = new CollectionFixture(["a"])
        fixture.set("root", "a", "A")
        const definition = fixture.definition("root")
        const epochOne = fixture.checkpoint("root")
        const sourceScheduler = new ManualScheduler()
        const source = new ExperimentalIndexOperations(
            definition,
            sourceScheduler,
        )
        source.demand(epochOne)
        sourceScheduler.runAll()
        const artifact = source.exportArtifact(epochOne)
        const baseOverlay = fixture.prepareScopeOverlay(
            artifact,
            epochOne,
            definition,
        )

        const update = fixture.prepare(
            fixture.set("root", "a", "A2"),
            definition,
        )
        const epochTwo = fixture.checkpoint("root")
        const cancelledScheduler = new ManualScheduler()
        const cancelled = new ExperimentalIndexOperations(
            definition,
            cancelledScheduler,
        )
        cancelled.demand(epochOne)
        cancelled.recordCommit(update)
        cancelled.cancel("pause")
        expect(
            cancelled.importArtifact({
                artifact,
                baseCheckpoint: epochOne,
                baseOverlay,
                laterCommits: [],
                targetCheckpoint: epochOne,
            }),
        ).toEqual({ ok: false, error: "STALE_ARTIFACT" })
        expect(() => cancelled.retry(epochOne)).toThrow(
            "older than consumed epoch",
        )
        expect(
            cancelled.importArtifact({
                artifact,
                baseCheckpoint: epochOne,
                baseOverlay,
                laterCommits: [update],
                targetCheckpoint: epochTwo,
            }),
        ).toMatchObject({ ok: true })

        const failedScheduler = new ManualScheduler()
        const failed = new ExperimentalIndexOperations(
            definition,
            failedScheduler,
        )
        failed.demand(epochOne)
        failedScheduler.runAll()
        const badDelta = Object.freeze({
            ...update.deltas[0]!,
            afterKey: undefined as unknown as string,
        })
        failed.recordCommit(
            Object.freeze({ ...update, deltas: Object.freeze([badDelta]) }),
        )
        expect(failed.status()).toMatchObject({
            state: "failed",
            throughEpoch: epochOne.epoch,
            code: "DELTA_CONTRACT_ERROR",
        })
        expect(failed.snapshot()).toBeUndefined()
        expect(
            failed.importArtifact({
                artifact,
                baseCheckpoint: epochOne,
                baseOverlay,
                laterCommits: [],
                targetCheckpoint: epochOne,
            }),
        ).toEqual({ ok: false, error: "STALE_ARTIFACT" })
        expect(() => failed.retry(epochOne)).toThrow(
            "older than consumed epoch",
        )

        for (const invalidPlan of [
            {
                baseCheckpoint: epochTwo,
                laterCommits: [] as readonly PreparedCollectionCommit[],
            },
            {
                baseCheckpoint: epochOne,
                laterCommits: [update] as readonly PreparedCollectionCommit[],
            },
        ]) {
            const rejected = new ExperimentalIndexOperations(
                definition,
                new ManualScheduler(),
            )
            expect(
                rejected.importArtifact({
                    artifact,
                    baseCheckpoint: invalidPlan.baseCheckpoint,
                    baseOverlay,
                    laterCommits: invalidPlan.laterCommits,
                    targetCheckpoint: epochOne,
                }),
            ).toEqual({ ok: false, error: "STALE_ARTIFACT" })
            expect(() => rejected.demand(epochOne)).toThrow(
                "older than consumed epoch",
            )
        }

        fixture.set("root", "a", "A3")
        const epochThree = fixture.checkpoint("root")
        expect(
            failed.importArtifact({
                artifact: Object.freeze({ ...artifact, checksum: "bad" }),
                baseCheckpoint: epochOne,
                baseOverlay,
                laterCommits: [],
                targetCheckpoint: epochThree,
            }),
        ).toEqual({ ok: false, error: "CORRUPT_ARTIFACT" })
        expect(() => failed.retry(epochTwo)).toThrow(
            "older than consumed epoch",
        )
    })

    test("V1I-OPS-012 rejects operational projector re-entry without state resurrection", () => {
        for (const action of ["demand", "cancel", "dispose"] as const) {
            const fixture = new CollectionFixture(["a"])
            fixture.set("root", "a", "A")
            const checkpoint = fixture.checkpoint("root")
            const scheduler = new ManualScheduler()
            let operations: ExperimentalIndexOperations
            let caughtCapabilityError = ""
            const definition = fixture.definition("root", () => {
                try {
                    if (action === "demand") operations.demand(checkpoint)
                    else if (action === "cancel") operations.cancel("reentrant")
                    else operations.dispose()
                } catch (error) {
                    caughtCapabilityError =
                        error instanceof Error ? error.message : String(error)
                }
                return "group"
            })
            operations = new ExperimentalIndexOperations(definition, scheduler)
            const demand = operations.demand(checkpoint)
            if (demand.state !== "building") throw new Error("building")

            scheduler.runAll()

            expect(caughtCapabilityError).toContain(
                "INDEX_OPERATION_CAPABILITY_ERROR",
            )
            expect(operations.status()).toMatchObject({
                state: "failed",
                code: "BUILD_FAILED",
                message: "Index projector failed",
                progress: { completed: 0, total: 1 },
            })
            expect(operations.snapshot()).toBeUndefined()
            expect(demand.wakeable.inspect()).toEqual({
                state: "rejected",
                reason: "BUILD_FAILED",
            })
            expect(
                operations.events().filter(event => event.kind === "progress"),
            ).toHaveLength(0)
            expect(
                operations.events().filter(event => event.kind === "published"),
            ).toHaveLength(0)
        }

        for (const catchesError of [true, false]) {
            const fixture = new CollectionFixture(["a"])
            fixture.set("root", "a", "A")
            const checkpoint = fixture.checkpoint("root")
            const domain = new ExperimentalIndexOperationDomain()
            const targetScheduler = new ManualScheduler()
            const target = new ExperimentalIndexOperations(
                fixture.definition("root"),
                targetScheduler,
                domain,
            )
            const targetDemand = target.demand(checkpoint)
            if (targetDemand.state !== "building") throw new Error("building")

            const callerScheduler = new ManualScheduler()
            const caller = new ExperimentalIndexOperations(
                fixture.definition("root", () => {
                    if (catchesError) {
                        try {
                            target.cancel("cross-instance")
                        } catch {
                            // A caught capability error still poisons this output.
                        }
                    } else {
                        target.cancel("cross-instance")
                    }
                    return "group"
                }),
                callerScheduler,
                domain,
            )
            caller.demand(checkpoint)
            callerScheduler.runAll()

            expect(caller.status()).toMatchObject({
                state: "failed",
                code: "BUILD_FAILED",
                progress: { completed: 0, total: 1 },
            })
            expect(caller.snapshot()).toBeUndefined()
            expect(target.status().state).toBe("building")
            expect(targetDemand.wakeable.inspect()).toEqual({
                state: "pending",
            })
            targetScheduler.runAll()
            expect(target.status().state).toBe("ready")
        }

        const independentFixture = new CollectionFixture(["a"])
        independentFixture.set("root", "a", "A")
        const independentCheckpoint = independentFixture.checkpoint("root")
        const independentTargetScheduler = new ManualScheduler()
        const independentTarget = new ExperimentalIndexOperations(
            independentFixture.definition("root"),
            independentTargetScheduler,
            new ExperimentalIndexOperationDomain(),
        )
        independentTarget.demand(independentCheckpoint)
        const independentCallerScheduler = new ManualScheduler()
        const independentCaller = new ExperimentalIndexOperations(
            independentFixture.definition("root", () => {
                independentTarget.cancel("separate-domain")
                return "group"
            }),
            independentCallerScheduler,
            new ExperimentalIndexOperationDomain(),
        )
        independentCaller.demand(independentCheckpoint)
        independentCallerScheduler.runAll()
        expect(independentCaller.status().state).toBe("ready")
        expect(independentTarget.status()).toMatchObject({
            state: "cancelled",
            reason: "separate-domain",
        })
    })

    test("V1I-OPS-013 rejects invalid and async-shaped projector keys before publication or preparation", () => {
        let containedThenables = 0
        const invalidResults = [
            () => undefined as unknown as string,
            () =>
                ({
                    then(
                        _fulfilled: unknown,
                        rejected?: (reason: unknown) => unknown,
                    ) {
                        containedThenables += 1
                        rejected?.("contained")
                    },
                }) as unknown as string,
        ]

        for (const invalidResult of invalidResults) {
            const fixture = new CollectionFixture(["a"])
            fixture.set("root", "a", "A")
            const scheduler = new ManualScheduler()
            const operations = new ExperimentalIndexOperations(
                fixture.definition("root", invalidResult),
                scheduler,
            )
            operations.demand(fixture.checkpoint("root"))
            scheduler.runAll()
            expect(operations.status()).toMatchObject({
                state: "failed",
                code: "BUILD_FAILED",
                message: "Index projector failed",
                progress: { completed: 0, total: 1 },
            })
            expect(operations.snapshot()).toBeUndefined()

            const prepareFixture = new CollectionFixture(["a"])
            const raw = prepareFixture.set("root", "a", "A")
            let prepared: PreparedCollectionCommit | undefined
            expect(() => {
                prepared = prepareFixture.prepare(
                    raw,
                    prepareFixture.definition("root", invalidResult),
                )
            }).toThrow("INVALID_INDEX_KEY")
            expect(prepared).toBeUndefined()
        }
        expect(containedThenables).toBe(2)

        const hostileFixture = new CollectionFixture(["a"])
        hostileFixture.set("root", "a", "A")
        let messageGetterRuns = 0
        const hostileError = new Error("initial")
        Object.defineProperty(hostileError, "message", {
            configurable: true,
            get() {
                messageGetterRuns += 1
                throw new Error("message-getter-ran")
            },
        })
        const hostileScheduler = new ManualScheduler()
        const hostileOperations = new ExperimentalIndexOperations(
            hostileFixture.definition("root", () => {
                throw hostileError
            }),
            hostileScheduler,
        )
        const hostileDemand = hostileOperations.demand(
            hostileFixture.checkpoint("root"),
        )
        if (hostileDemand.state !== "building") throw new Error("building")
        expect(() => hostileScheduler.runAll()).not.toThrow()
        expect(messageGetterRuns).toBe(0)
        expect(hostileOperations.status()).toMatchObject({
            state: "failed",
            code: "BUILD_FAILED",
            message: "Index projector failed",
            progress: { completed: 0, total: 1 },
        })
        expect(hostileDemand.wakeable.inspect()).toEqual({
            state: "rejected",
            reason: "BUILD_FAILED",
        })
        expect(hostileOperations.snapshot()).toBeUndefined()

        const proxyFixture = new CollectionFixture(["a"])
        proxyFixture.set("root", "a", "A")
        let descriptorTraps = 0
        let proxyOperations: ExperimentalIndexOperations
        const proxyError = new Proxy(
            {},
            {
                getOwnPropertyDescriptor() {
                    descriptorTraps += 1
                    proxyOperations.dispose()
                    return {
                        configurable: true,
                        enumerable: false,
                        writable: true,
                        value: "proxied",
                    }
                },
            },
        )
        const proxyScheduler = new ManualScheduler()
        proxyOperations = new ExperimentalIndexOperations(
            proxyFixture.definition("root", () => {
                throw proxyError
            }),
            proxyScheduler,
        )
        const proxyDemand = proxyOperations.demand(
            proxyFixture.checkpoint("root"),
        )
        if (proxyDemand.state !== "building") throw new Error("building")
        expect(() => proxyScheduler.runAll()).not.toThrow()
        expect(descriptorTraps).toBe(0)
        expect(proxyOperations.status()).toMatchObject({
            state: "failed",
            code: "BUILD_FAILED",
            message: "Index projector failed",
        })
        expect(proxyDemand.wakeable.inspect()).toEqual({
            state: "rejected",
            reason: "BUILD_FAILED",
        })
        expect(proxyOperations.snapshot()).toBeUndefined()
    })

    test("V1I-OPS-014 reconciles a root artifact through a prepared child override and tombstone overlay", () => {
        const fixture = new CollectionFixture(["a", "b", "c"])
        fixture.set("root", "a", "A")
        fixture.set("root", "b", "B")
        fixture.set("root", "c", "C")
        fixture.createChild()
        fixture.set("child", "b", "child-B")
        fixture.remove("child", "c")
        const rootBase = fixture.checkpoint("root")
        const childBase = fixture.checkpoint("child")
        const rootDefinition = fixture.definition("root")
        const sourceScheduler = new ManualScheduler()
        const source = new ExperimentalIndexOperations(
            rootDefinition,
            sourceScheduler,
        )
        source.demand(rootBase)
        sourceScheduler.runAll()
        const artifact = source.exportArtifact(rootBase)

        let importProjectCalls = 0
        const childDefinition = fixture.definition("child", () => {
            importProjectCalls += 1
            throw new Error("import must consume prepared overlay keys")
        })
        const overlay = fixture.prepareScopeOverlay(
            artifact,
            childBase,
            childDefinition,
            stringProjector,
        )
        const shielded = [
            fixture.set("root", "b", "B2"),
            fixture.set("root", "c", "C2"),
        ]
        expect(shielded.flatMap(commit => deltasFor(commit, "child"))).toEqual(
            [],
        )
        const laterCommits = shielded.map(commit =>
            fixture.prepare(commit, childDefinition, stringProjector),
        )
        const childTarget = fixture.checkpoint("child")
        const operations = new ExperimentalIndexOperations(
            childDefinition,
            new ManualScheduler(),
        )

        expect(
            operations.importArtifact({
                artifact,
                baseCheckpoint: childBase,
                baseOverlay: overlay,
                laterCommits,
                targetCheckpoint: childTarget,
            }),
        ).toMatchObject({
            ok: true,
            snapshot: {
                scope: "child",
                buckets: [
                    { key: "A", rows: ["a"] },
                    { key: "child-B", rows: ["b"] },
                ],
            },
        })
        expect(importProjectCalls).toBe(0)
    })

    test("V1I-OPS-015 rejects malformed prepared batches before any publication", () => {
        for (const malformed of [
            "missing-birth",
            "duplicate-birth",
            "duplicate-row",
        ] as const) {
            const fixture = new CollectionFixture(["a", "b"])
            const definition = fixture.definition("root")
            const scheduler = new ManualScheduler()
            const operations = new ExperimentalIndexOperations(
                definition,
                scheduler,
            )
            operations.demand(fixture.checkpoint("root"))
            const prepared = fixture.prepare(
                fixture.transactSet("root", [
                    { row: "b", label: "B" },
                    { row: "a", label: "A" },
                ]),
                definition,
            )
            const delta = prepared.deltas[0]!
            let deltas: PreparedCollectionCommit["deltas"]
            if (malformed === "missing-birth") {
                const { birthSequence: _ignored, ...withoutBirth } = delta
                deltas = Object.freeze([
                    Object.freeze(withoutBirth),
                    prepared.deltas[1]!,
                ])
            } else if (malformed === "duplicate-row") {
                deltas = Object.freeze([delta, delta])
            } else {
                deltas = Object.freeze(
                    prepared.deltas.map(entry =>
                        Object.freeze({ ...entry, birthSequence: 1 }),
                    ),
                )
            }
            operations.recordCommit(Object.freeze({ ...prepared, deltas }))
            scheduler.runAll()

            expect(operations.status()).toMatchObject({
                state: "failed",
                code: "DELTA_CONTRACT_ERROR",
            })
            expect(operations.snapshot()).toBeUndefined()
            expect(
                operations.events().filter(event => event.kind === "published"),
            ).toHaveLength(0)
        }
    })

    test("V1I-OPS-016 reuses the observable snapshot when values change under stable keys", () => {
        const fixture = new CollectionFixture(["a"])
        fixture.set("root", "a", "A")
        const definition = fixture.definition("root", () => "group")
        const epochOne = fixture.checkpoint("root")
        const scheduler = new ManualScheduler()
        const operations = new ExperimentalIndexOperations(
            definition,
            scheduler,
        )
        operations.demand(epochOne)
        scheduler.runAll()
        const initial = operations.snapshot()!
        const artifact = operations.exportArtifact(epochOne)
        const overlay = fixture.prepareScopeOverlay(
            artifact,
            epochOne,
            definition,
        )
        const update = fixture.prepare(
            fixture.set("root", "a", "A2"),
            definition,
        )
        const epochTwo = fixture.checkpoint("root")

        operations.recordCommit(update)
        expect(operations.snapshot()).toBe(initial)
        expect(operations.status()).toMatchObject({
            state: "ready",
            throughEpoch: epochTwo.epoch,
        })
        expect(
            operations.events().filter(event => event.kind === "published"),
        ).toHaveLength(1)
        expect(operations.exportArtifact(epochTwo).rows[0]?.value).toEqual(
            epochTwo.rows[0]?.value,
        )

        const importScheduler = new ManualScheduler()
        const imported = new ExperimentalIndexOperations(
            definition,
            importScheduler,
        )
        imported.demand(epochOne)
        importScheduler.runAll()
        const beforeImport = imported.snapshot()!
        expect(
            imported.importArtifact({
                artifact,
                baseCheckpoint: epochOne,
                baseOverlay: overlay,
                laterCommits: [update],
                targetCheckpoint: epochTwo,
            }),
        ).toEqual({ ok: true, snapshot: beforeImport })
        expect(imported.snapshot()).toBe(beforeImport)
        expect(
            imported.events().filter(event => event.kind === "published"),
        ).toHaveLength(1)
        expect(imported.exportArtifact(epochTwo).rows[0]?.value).toEqual(
            epochTwo.rows[0]?.value,
        )
    })

    test("V1I-OPS-017 invalidates ready state when demand reveals a missing newer commit", () => {
        const fixture = new CollectionFixture(["a"])
        fixture.set("root", "a", "A")
        const definition = fixture.definition("root")
        const epochOne = fixture.checkpoint("root")
        const scheduler = new ManualScheduler()
        const operations = new ExperimentalIndexOperations(
            definition,
            scheduler,
        )
        operations.demand(epochOne)
        scheduler.runAll()
        fixture.set("root", "a", "A2")
        const epochTwo = fixture.checkpoint("root")

        expect(() => operations.demand(epochTwo)).toThrow(
            "must advance through collection commits",
        )
        expect(operations.status()).toMatchObject({
            state: "failed",
            code: "DELTA_SEQUENCE_ERROR",
        })
        expect(operations.snapshot()).toBeUndefined()
        expect(() => operations.retry(epochOne)).toThrow(
            "older than consumed epoch",
        )
        operations.retry(epochTwo)
        scheduler.runAll()
        expect(operations.snapshot()?.buckets).toEqual([
            { key: "A2", rows: ["a"] },
        ])
    })

    test("V1I-OPS-018 validates artifact keys through the prepared overlay", () => {
        const fixture = new CollectionFixture(["a"])
        fixture.set("root", "a", "A")
        const checkpoint = fixture.checkpoint("root")
        const sourceScheduler = new ManualScheduler()
        const source = new ExperimentalIndexOperations(
            fixture.definition("root", () => "forged"),
            sourceScheduler,
        )
        source.demand(checkpoint)
        sourceScheduler.runAll()
        const artifact = source.exportArtifact(checkpoint)
        expect(artifact.rows[0]?.key).toBe("forged")

        let importProjectCalls = 0
        const definition = fixture.definition("root", () => {
            importProjectCalls += 1
            throw new Error("artifact import must not project")
        })
        const overlay = fixture.prepareScopeOverlay(
            artifact,
            checkpoint,
            definition,
            stringProjector,
        )
        const operations = new ExperimentalIndexOperations(
            definition,
            new ManualScheduler(),
        )

        expect(
            operations.importArtifact({
                artifact,
                baseCheckpoint: checkpoint,
                baseOverlay: overlay,
                laterCommits: [],
                targetCheckpoint: checkpoint,
            }),
        ).toEqual({ ok: false, error: "CORRUPT_ARTIFACT" })
        expect(operations.snapshot()).toBeUndefined()
        expect(importProjectCalls).toBe(0)
    })
})

function assertMonotonic(history: readonly OperationStatus[]): void {
    const byGeneration = new Map<number, OperationStatus[]>()
    for (const status of history) {
        if (status.generation === 0) continue
        const statuses = byGeneration.get(status.generation)
        if (statuses === undefined)
            byGeneration.set(status.generation, [status])
        else statuses.push(status)
    }
    for (const statuses of byGeneration.values()) {
        let completed = 0
        let throughEpoch = -1
        let total: number | undefined
        for (const status of statuses) {
            expect(status.progress.completed).toBeGreaterThanOrEqual(completed)
            completed = status.progress.completed
            if (total === undefined) total = status.progress.total
            else expect(status.progress.total).toBe(total)
            if ("throughEpoch" in status) {
                expect(status.throughEpoch).toBeGreaterThanOrEqual(throughEpoch)
                throughEpoch = status.throughEpoch
            }
        }
    }
}
