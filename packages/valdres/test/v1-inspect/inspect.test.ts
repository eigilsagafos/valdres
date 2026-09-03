import { describe, expect, test } from "bun:test"
import * as publicApi from "../../src/index"
import {
    atom,
    selector,
    store as createStore,
    type Store,
} from "../../src/index"
import {
    assertStore,
    read as adapterRead,
} from "../../src/adapter-internals/v1"
import { createInspectableStore } from "../../src/inspect"

type Inspector = ReturnType<typeof createInspectableStore>["inspect"]
type InspectionExport = ReturnType<Inspector["export"]>
type InspectionSummary = InspectionExport["summaries"][number]
type OperationSummary = Extract<InspectionSummary, { type: "operation" }>
type SpanSummary = Extract<InspectionSummary, { type: "span" }>
type CommitSummary = Extract<InspectionSummary, { type: "commit" }>

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const operationSummaries = (
    inspection: InspectionExport,
): readonly OperationSummary[] =>
    inspection.summaries.filter(
        (summary): summary is OperationSummary => summary.type === "operation",
    )

const spanSummaries = (inspection: InspectionExport): readonly SpanSummary[] =>
    inspection.summaries.filter(
        (summary): summary is SpanSummary => summary.type === "span",
    )

const commitSummaries = (
    inspection: InspectionExport,
): readonly CommitSummary[] =>
    inspection.summaries.filter(
        (summary): summary is CommitSummary => summary.type === "commit",
    )

const assertJsonSafe = (
    value: unknown,
    ancestors: Set<object> = new Set(),
): void => {
    if (value === null) return
    switch (typeof value) {
        case "string":
        case "boolean":
            return
        case "number":
            expect(Number.isFinite(value)).toBe(true)
            return
        case "object": {
            if (ancestors.has(value)) {
                throw new Error("Inspection export contains a cycle")
            }
            ancestors.add(value)
            for (const key of Reflect.ownKeys(value)) {
                expect(typeof key).toBe("string")
                assertJsonSafe(Reflect.get(value, key), ancestors)
            }
            ancestors.delete(value)
            return
        }
        default:
            throw new Error(
                `Inspection export contains non-JSON value: ${typeof value}`,
            )
    }
}

const expectCompleteRecording = (
    inspect: Inspector,
    recording: InspectionExport,
): void => {
    expect(recording).toMatchObject({
        schema: "valdres.inspect",
        schemaVersion: 2,
        recordingId: inspect.recordingId,
        complete: true,
        overflow: { summaries: 0, details: 0 },
    })
    expect("fault" in recording).toBe(false)
}

describe("valdres/inspect public contract", () => {
    test("creates a same-domain Store for public State handles and the adapter", () => {
        const count = atom(1, { name: "count" })
        const doubled = selector(get => get(count) * 2, { name: "doubled" })
        const ordinary = createStore()
        const { store, inspect } = createInspectableStore()
        const publicStore: Store = store

        assertStore(publicStore)
        expect(adapterRead(publicStore, doubled)).toBe(2)
        publicStore.set(count, 3)
        expect(publicStore.get(doubled)).toBe(6)
        expect(ordinary.get(doubled)).toBe(2)

        const recording = inspect.export()
        expectCompleteRecording(inspect, recording)
        expect(operationSummaries(recording)).toHaveLength(1)
    })

    test("captures owned Store and State identity without recording work", () => {
        const secret = "DO_NOT_CAPTURE_THIS_VALUE"
        const count = atom({ secret }, { name: "capture/count" })
        const { store, inspect } = createInspectableStore()
        const child = store.scope("capture-child")
        const before = inspect.export()

        const rootCapture = inspect.capture(store, count)
        const childCapture = inspect.capture(child, count)

        expect(inspect.export()).toEqual(before)
        expect(rootCapture).toEqual({
            recordingId: inspect.recordingId,
            timeUs: expect.any(Number),
            monotonicTimeMs: expect.any(Number),
            store: { id: expect.any(Number), kind: "scope" },
            state: {
                id: expect.any(Number),
                kind: "atom",
                name: "capture/count",
            },
        })
        expect(childCapture).toMatchObject({
            recordingId: inspect.recordingId,
            store: {
                id: expect.any(Number),
                kind: "scope",
                name: "capture-child",
            },
            state: rootCapture.state,
        })
        expect(childCapture.store.id).not.toBe(rootCapture.store.id)
        expect(Number.isSafeInteger(rootCapture.timeUs)).toBe(true)
        expect(Number.isFinite(rootCapture.monotonicTimeMs)).toBe(true)
        expect(childCapture.timeUs).toBeGreaterThanOrEqual(rootCapture.timeUs)
        expect(Object.isFrozen(rootCapture)).toBe(true)
        expect(Object.isFrozen(rootCapture.store)).toBe(true)
        expect(Object.isFrozen(rootCapture.state)).toBe(true)
        assertJsonSafe(rootCapture)
        expect(JSON.stringify(rootCapture)).not.toContain(secret)

        child.set(count, { secret: "next" })
        const recording = inspect.export()
        const [operation] = operationSummaries(recording)
        const intent = recording.details.find(
            detail => detail.type === "intent",
        )
        expect(operation?.scope).toEqual(childCapture.store)
        expect(intent?.type === "intent" ? intent.atom : undefined).toEqual(
            childCapture.state,
        )

        if (false) {
            const stateReference = inspect.capture(store, count).state
            stateReference satisfies NonNullable<typeof stateReference>
            // @ts-expect-error Capture requires a Store.
            inspect.capture({})
            // @ts-expect-error Capture accepts only State handles.
            inspect.capture(store, {})
        }
    })

    test("rejects Stores outside the inspector and invalid State handles", () => {
        const count = atom(0)
        const ordinary = createStore()
        const first = createInspectableStore()
        const second = createInspectableStore()
        const before = first.inspect.export()

        for (const invalidStore of [ordinary, second.store, {} as Store]) {
            expect(
                thrownBy(() =>
                    Reflect.apply(first.inspect.capture, undefined, [
                        invalidStore,
                        count,
                    ]),
                ),
            ).toBeInstanceOf(TypeError)
        }
        for (const invalidState of [
            null,
            {},
            Object.freeze({ kind: "atom" }),
        ]) {
            expect(
                thrownBy(() =>
                    Reflect.apply(first.inspect.capture, undefined, [
                        first.store,
                        invalidState,
                    ]),
                ),
            ).toBeInstanceOf(TypeError)
        }

        expect(first.inspect.export()).toEqual(before)
        expect(first.inspect.capture(first.store)).not.toHaveProperty("state")
    })

    test("does not execute or retain malformed State names during capture", () => {
        let reads = 0
        const hostileName = Object.defineProperty({}, "length", {
            get: () => {
                reads++
                throw new Error("State names are not application data")
            },
        })
        const count = atom(0, {
            name: hostileName as unknown as string,
        })
        const { store, inspect } = createInspectableStore()
        const before = inspect.export()

        const capture = inspect.capture(store, count)

        expect(reads).toBe(0)
        expect(capture.state).toEqual({
            id: expect.any(Number),
            kind: "atom",
        })
        expect(inspect.export()).toEqual(before)
        expect(JSON.stringify(capture)).not.toContain("application data")
    })

    test("captures the active span, operation, and commit during notification", () => {
        const count = atom(0, { name: "capture/notification-count" })
        const { store, inspect } = createInspectableStore()
        let notificationCapture:
            | ReturnType<typeof inspect.capture<number>>
            | undefined
        const unsubscribe = store.sub(count, () => {
            notificationCapture = inspect.capture(store, count)
        })

        inspect.span("react interaction", () => store.set(count, 1))
        unsubscribe()

        const recording = inspect.export()
        const [operation] = operationSummaries(recording)
        const [commit] = commitSummaries(recording)
        const [span] = spanSummaries(recording)
        expect(notificationCapture).toMatchObject({
            recordingId: recording.recordingId,
            spanId: span?.spanId,
            operationId: operation?.operationId,
            commitId: commit?.commitId,
            store: operation?.scope,
            state: {
                kind: "atom",
                name: "capture/notification-count",
            },
        })
        expect(operation?.spanId).toBe(span?.spanId)
        expect(commit?.operationId).toBe(operation?.operationId)
    })

    test("starts captures in the fresh recording after reset", () => {
        const count = atom(0, { name: "capture/reset-count" })
        const { store, inspect } = createInspectableStore()
        const first = inspect.capture(store, count)

        inspect.reset()
        const second = inspect.capture(store, count)

        expect(second.recordingId).toBe(inspect.recordingId)
        expect(second.recordingId).not.toBe(first.recordingId)
        expect(second.store).toEqual(first.store)
        expect(second.state).toEqual(first.state)
        expect(inspect.export().summaries).toEqual([])
        expect(inspect.export().details).toEqual([])
    })

    test("keeps the ordinary Store surface and behavior unchanged", () => {
        const count = atom(0)
        const ordinary = createStore()
        const inspected = createInspectableStore()
        const operationKeys = [
            "dispose",
            "get",
            "reset",
            "scope",
            "set",
            "sub",
            "txn",
            "update",
        ]

        expect(Object.keys(ordinary).sort()).toEqual(operationKeys)
        expect(Object.keys(inspected.store).sort()).toEqual(operationKeys)
        expect("inspect" in ordinary).toBe(false)
        expect("inspect" in inspected.store).toBe(false)
        expect("createInspectableStore" in publicApi).toBe(false)
        expect(createStore.length).toBe(0)

        const ordinaryResult: number = ordinary.txn(transaction => {
            transaction.set(count, 2)
            return transaction.get(count)
        }, "ordinary transaction")
        const inspectedResult: number = inspected.store.txn(transaction => {
            transaction.set(count, 2)
            return transaction.get(count)
        }, "inspected transaction")

        expect(ordinaryResult).toBe(2)
        expect(inspectedResult).toBe(2)
        expect(ordinary.get(count)).toBe(inspected.store.get(count))

        if (false) {
            // @ts-expect-error Transaction labels are strings.
            ordinary.txn(() => undefined, 1)
            // @ts-expect-error Ordinary Stores do not expose inspection state.
            ordinary.inspect.export()
            // @ts-expect-error Inspection capacity is numeric.
            createInspectableStore({ capacity: { summaries: "tiny" } })
            // @ts-expect-error Span names are strings.
            inspected.inspect.span(1, () => undefined)
            // @ts-expect-error Span callbacks are functions.
            inspected.inspect.span("invalid", 1)
        }
    })

    test("validates transaction labels before invoking callbacks or recording work", () => {
        const ordinary = createStore()
        const inspected = createInspectableStore()
        let ordinaryCalls = 0
        let inspectedCalls = 0

        const ordinaryError = thrownBy(() =>
            Reflect.apply(ordinary.txn, undefined, [() => ordinaryCalls++, 17]),
        )
        const inspectedError = thrownBy(() =>
            Reflect.apply(inspected.store.txn, undefined, [
                () => inspectedCalls++,
                { label: "invalid" },
            ]),
        )

        expect(ordinaryError).toBeInstanceOf(TypeError)
        expect(inspectedError).toBeInstanceOf(TypeError)
        expect(ordinaryCalls).toBe(0)
        expect(inspectedCalls).toBe(0)
        expect(inspected.inspect.export().summaries).toEqual([])

        inspected.store.txn(() => undefined, "")
        const [emptyLabel] = operationSummaries(inspected.inspect.export())
        expect(emptyLabel).toMatchObject({
            operation: "transaction",
            name: "",
            result: "returned",
            effect: "none",
        })
    })

    test("validates span names and callbacks before recording a span", () => {
        const { inspect } = createInspectableStore()
        let callbackCalls = 0

        const nameError = thrownBy(() =>
            Reflect.apply(inspect.span, undefined, [
                { label: "invalid" },
                () => callbackCalls++,
            ]),
        )
        const callbackError = thrownBy(() =>
            Reflect.apply(inspect.span, undefined, ["invalid", null]),
        )

        expect(nameError).toBeInstanceOf(TypeError)
        expect(callbackError).toBeInstanceOf(TypeError)
        expect(callbackCalls).toBe(0)
        expect(inspect.export().summaries).toEqual([])
    })

    test("uses operation identity, not duplicate transaction labels, for correlation", () => {
        const count = atom(0)
        const { store, inspect } = createInspectableStore()

        for (const value of [1, 2]) {
            store.txn(transaction => transaction.set(count, value), "drop")
        }

        const operations = operationSummaries(inspect.export()).filter(
            summary => summary.operation === "transaction",
        )
        expect(operations).toHaveLength(2)
        expect(operations.map(summary => summary.name)).toEqual([
            "drop",
            "drop",
        ])
        expect(
            new Set(operations.map(summary => summary.operationId)).size,
        ).toBe(2)
        expect(new Set(operations.map(summary => summary.commitId)).size).toBe(
            2,
        )
    })

    test("summarizes returned, no-effect, and throwing transactions exactly", () => {
        const count = atom(0)
        const { store, inspect } = createInspectableStore()
        const cause = new Error("transaction failed")

        expect(
            store.txn(transaction => {
                transaction.set(count, 1)
                return "committed"
            }, "successful"),
        ).toBe("committed")
        expect(
            store.txn(transaction => transaction.get(count), "read-only no-op"),
        ).toBe(1)
        expect(
            thrownBy(() =>
                store.txn(transaction => {
                    transaction.set(count, 2)
                    throw cause
                }, "throwing"),
            ),
        ).toBe(cause)
        expect(store.get(count)).toBe(1)

        const recording = inspect.export()
        expectCompleteRecording(inspect, recording)
        const operations = operationSummaries(recording)
        const successful = operations.find(
            summary => summary.name === "successful",
        )
        const noOp = operations.find(
            summary => summary.name === "read-only no-op",
        )
        const throwing = operations.find(summary => summary.name === "throwing")

        expect(successful).toMatchObject({
            operation: "transaction",
            result: "returned",
            effect: "committed",
        })
        expect(successful?.commitId).toBeDefined()
        expect(successful?.totals).toEqual(expect.any(Object))
        expect(noOp).toMatchObject({
            operation: "transaction",
            result: "returned",
            effect: "none",
        })
        expect("commitId" in noOp!).toBe(false)
        expect(throwing).toMatchObject({
            operation: "transaction",
            result: "threw",
            effect: "none",
        })
        expect("commitId" in throwing!).toBe(false)

        const commits = commitSummaries(recording)
        expect(commits).toHaveLength(1)
        expect(commits[0]!.commitId).toBe(successful!.commitId!)
    })

    test("assigns direct set, update, and reset their own operation IDs", () => {
        const count = atom(0)
        const { store, inspect } = createInspectableStore()

        store.set(count, 1)
        store.update(count, current => current + 1)
        store.reset(count)

        const recording = inspect.export()
        const operations = operationSummaries(recording)
        expect(operations.map(summary => summary.operation)).toEqual([
            "set",
            "update",
            "reset",
        ])
        expect(operations.map(summary => summary.operationId)).toEqual([
            1, 2, 3,
        ])
        expect(operations.map(summary => summary.commitId)).toEqual([1, 2, 3])
        expect(
            operations.every(
                summary =>
                    summary.result === "returned" &&
                    summary.effect === "committed" &&
                    !("name" in summary),
            ),
        ).toBe(true)
        expect(commitSummaries(recording)).toHaveLength(3)
        expect(
            recording.details
                .filter(detail => detail.type === "intent")
                .map(detail => detail.intent),
        ).toEqual(["set", "set", "reset"])
    })

    test("keeps one transaction operation across scopes and rejects captured reentry", () => {
        const count = atom(0)
        const { store, inspect } = createInspectableStore()
        const left = store.scope("left")
        const right = store.scope("right")
        let reentryError: unknown

        store.txn(transaction => {
            try {
                store.set(count, 99)
            } catch (error) {
                reentryError = error
            }
            transaction.scope(left).set(count, 1)
            transaction.scope(right).set(count, 2)
        }, "cross-scope")

        expect(reentryError).toMatchObject({
            code: "VALDRES_TRANSACTION_PHASE",
        })
        expect(store.get(count)).toBe(0)
        expect(left.get(count)).toBe(1)
        expect(right.get(count)).toBe(2)

        const recording = inspect.export()
        const operations = operationSummaries(recording)
        expect(operations).toHaveLength(1)
        expect(operations[0]).toMatchObject({
            operationId: 1,
            operation: "transaction",
            name: "cross-scope",
            result: "returned",
            effect: "committed",
            commitId: 1,
        })
        expect(commitSummaries(recording)).toHaveLength(1)
        expect(
            recording.details.filter(detail => detail.type === "intent"),
        ).toHaveLength(2)
    })

    test("links nested spans without turning them into transactions", () => {
        const count = atom(0)
        const { store, inspect } = createInspectableStore()

        const result = inspect.span("drag", () => {
            store.set(count, 1)
            return inspect.span("drop", () => {
                store.update(count, current => current + 1)
                return "done"
            })
        })

        expect(result).toBe("done")
        expect(store.get(count)).toBe(2)
        const recording = inspect.export()
        const spans = spanSummaries(recording)
        const outer = spans.find(summary => summary.name === "drag")
        const inner = spans.find(summary => summary.name === "drop")

        expect(spans).toHaveLength(2)
        expect(outer).toMatchObject({ result: "returned" })
        expect(inner).toMatchObject({
            parentSpanId: outer?.spanId,
            result: "returned",
        })
        expect("parentSpanId" in outer!).toBe(false)
        expect(outer?.spanId).not.toBe(inner?.spanId)
        expect(operationSummaries(recording)).toHaveLength(2)
        expect(commitSummaries(recording)).toHaveLength(2)
    })

    test("exposes the active Store and evaluator links on span summaries", () => {
        const count = atom(0)
        const { store, inspect } = createInspectableStore()
        const derived = selector(() => inspect.span("selector phase", () => 1))

        store.txn(transaction => {
            inspect.span("transaction phase", () => transaction.set(count, 1))
        }, "linked transaction")
        const unsubscribe = store.sub(count, () => {
            inspect.span("notification phase", () => undefined)
        })
        store.set(count, 2)
        unsubscribe()
        expect(store.get(derived)).toBe(1)

        const recording = inspect.export()
        const transactionOperation = operationSummaries(recording).find(
            summary => summary.name === "linked transaction",
        )
        const setOperation = operationSummaries(recording).find(
            summary =>
                summary.operation === "set" &&
                summary.operationId !== transactionOperation?.operationId,
        )
        const transactionSpan = spanSummaries(recording).find(
            summary => summary.name === "transaction phase",
        )
        const notificationSpan = spanSummaries(recording).find(
            summary => summary.name === "notification phase",
        )
        const selectorSpan = spanSummaries(recording).find(
            summary => summary.name === "selector phase",
        )

        expect(transactionSpan).toMatchObject({
            operationId: transactionOperation?.operationId,
        })
        expect(transactionSpan?.commitId).toBeUndefined()
        expect(notificationSpan).toMatchObject({
            operationId: setOperation?.operationId,
            commitId: setOperation?.commitId,
        })
        expect(selectorSpan).toMatchObject({
            sessionId: expect.any(Number),
            evaluationId: expect.any(Number),
        })
    })

    test("keeps export and reset idle-only and reset starts a fresh recording", () => {
        const count = atom(0)
        const { store, inspect } = createInspectableStore()
        let exportError: unknown
        let resetError: unknown

        inspect.span("busy", () => {
            exportError = thrownBy(() => inspect.export())
            resetError = thrownBy(() => inspect.reset())
            store.set(count, 1)
        })

        expect(exportError).toBeInstanceOf(Error)
        expect(resetError).toBeInstanceOf(Error)
        const first = inspect.export()
        expect(first.summaries.length).toBeGreaterThan(0)

        expect(inspect.reset()).toBeUndefined()
        const second = inspect.export()
        expect(second.recordingId).not.toBe(first.recordingId)
        expect(second.recordingId).toBe(inspect.recordingId)
        expect(second.summaries).toEqual([])
        expect(second.details).toEqual([])
        expect(second.overflow).toEqual({
            summaries: 0,
            details: 0,
            retained: {},
        })
        expect(second.complete).toBe(true)
        expect("fault" in second).toBe(false)
        expect(store.get(count)).toBe(1)

        store.update(count, current => current + 1)
        expect(operationSummaries(inspect.export())[0]?.operationId).toBe(1)
    })

    test("exports JSON-safe diagnostics without retaining raw State values", () => {
        const secret = "DO_NOT_CAPTURE_THIS_STATE_VALUE"
        const raw: {
            secret: string
            bigint: bigint
            symbol: symbol
            self?: unknown
        } = {
            secret,
            bigint: 9n,
            symbol: Symbol("private"),
        }
        raw.self = raw
        const value = atom<unknown>(null, { name: "opaque value" })
        const { store, inspect } = createInspectableStore()

        store.set(value, raw)
        const recording = inspect.export()
        assertJsonSafe(recording)
        const encoded = JSON.stringify(recording)

        expect(encoded).not.toContain(secret)
        expect(JSON.parse(encoded)).toEqual(recording)
        expect(
            recording.details.every(detail => typeof detail.type === "string"),
        ).toBe(true)
        expect(
            recording.details.every(detail =>
                [
                    "scope",
                    "subscription",
                    "intent",
                    "transaction-read",
                    "scratch",
                    "selector-evaluation",
                    "selector-publication",
                    "cycle-search",
                    "propagation",
                    "notification",
                ].includes(detail.type),
            ),
        ).toBe(true)
    })

    test("bounds both rings, reports overflow, and clears loss on reset", () => {
        const count = atom(0)
        const { store, inspect } = createInspectableStore({
            capacity: { summaries: 2, details: 1 },
        })

        for (let value = 1; value <= 4; value++) store.set(count, value)

        const overflowed = inspect.export()
        expect(overflowed.summaries).toHaveLength(2)
        expect(overflowed.details).toHaveLength(1)
        expect(overflowed.overflow.summaries).toBeGreaterThan(0)
        expect(overflowed.overflow.details).toBeGreaterThan(0)
        expect(overflowed.complete).toBe(false)
        expect("fault" in overflowed).toBe(false)
        assertJsonSafe(overflowed)

        inspect.reset()
        const cleared = inspect.export()
        expect(cleared.summaries).toEqual([])
        expect(cleared.details).toEqual([])
        expect(cleared.overflow).toEqual({
            summaries: 0,
            details: 0,
            retained: {},
        })
        expect(cleared.complete).toBe(true)
    })
})
