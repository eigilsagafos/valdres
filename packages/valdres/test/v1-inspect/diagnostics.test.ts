import { describe, expect, test } from "bun:test"
import {
    atom,
    selector,
    SelectorCircularDependencyError,
    type Selector,
} from "../../src/index"
import { readHydrationSnapshot } from "../../src/adapter-internals/v1"
import { deepEqual } from "../../src/equality"
import { createInspectionRecorder } from "../../src/v1-internal/inspection"
import {
    createInspectableStore,
    type InspectionCycleBucket,
    type InspectionDetail,
    type InspectionExport,
    type InspectionJsonValue,
    type OperationInspection,
    type SpanInspection,
} from "../../src/inspect"

const EMPTY_CYCLE_BUCKET: InspectionCycleBucket = Object.freeze({
    searches: 0,
    visits: 0,
    maxVisits: 0,
    found: 0,
})

const operationNamed = (
    report: InspectionExport,
    name: string,
): OperationInspection => {
    const operation = report.summaries.find(
        (summary): summary is OperationInspection =>
            summary.type === "operation" && summary.name === name,
    )
    if (operation === undefined) {
        throw new Error(`Missing inspection operation: ${name}`)
    }
    return operation
}

const spanNamed = (report: InspectionExport, name: string): SpanInspection => {
    const span = report.summaries.find(
        (summary): summary is SpanInspection =>
            summary.type === "span" && summary.name === name,
    )
    if (span === undefined) throw new Error(`Missing inspection span: ${name}`)
    return span
}

const detailsOfType = <Type extends InspectionDetail["type"]>(
    report: InspectionExport,
    type: Type,
): readonly Extract<InspectionDetail, { type: Type }>[] =>
    report.details.filter(
        (detail): detail is Extract<InspectionDetail, { type: Type }> =>
            detail.type === type,
    )

const referenceName = (
    value: InspectionJsonValue | undefined,
): string | undefined => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return undefined
    }
    const name = (value as Record<string, InspectionJsonValue>).name
    return typeof name === "string" ? name : undefined
}

const expectJsonRoundTrip = (report: InspectionExport): void => {
    const encoded = JSON.stringify(report)
    expect(JSON.parse(encoded)).toEqual(report)
}

const prepareNegativeNewEdge = (detailCapacity?: number) => {
    const flag = atom(false, { name: "negative-edge/flag" })
    const leaf = atom(1, { name: "negative-edge/leaf" })
    const child = selector(get => get(leaf), {
        name: "negative-edge/child",
    })
    const root = selector(get => (get(flag) ? get(child) : 0), {
        name: "negative-edge/root",
    })
    const created = createInspectableStore(
        detailCapacity === undefined
            ? undefined
            : { capacity: { details: detailCapacity } },
    )

    expect(created.store.get(child)).toBe(1)
    expect(created.store.get(root)).toBe(0)
    created.inspect.reset()

    return { ...created, flag, root }
}

describe("valdres/inspect public structural diagnostics", () => {
    test("attributes one negative committed new-edge proof to its named transaction", () => {
        const { store, inspect, flag, root } = prepareNegativeNewEdge()

        store.txn(transaction => transaction.set(flag, true), "negative edge")

        expect(store.get(root)).toBe(1)
        const report = inspect.export()
        const operation = operationNamed(report, "negative edge")
        const committed = operation.totals.cycle.byLane.committed

        expect(operation).toMatchObject({
            result: "returned",
            effect: "committed",
            commitId: 1,
            totals: {
                selectorEvaluations: 1,
                proposedTopologyChanges: 1,
                proposedTopologyIdentical: 0,
                cycle: {
                    searches: 1,
                    visits: 0,
                    maxVisits: 0,
                    found: 0,
                    reverseProof: { terminal: 1 },
                },
            },
        })
        expect(committed.prefixRevalidation).toEqual(EMPTY_CYCLE_BUCKET)
        expect(committed.newEdgeProof).toEqual({
            searches: 1,
            visits: 0,
            maxVisits: 0,
            found: 0,
        })
        expect(operation.totals.cycle.byLane.scratch.newEdgeProof).toEqual(
            EMPTY_CYCLE_BUCKET,
        )
        expect(operation.totals.cycle.byLane.hydration.newEdgeProof).toEqual(
            EMPTY_CYCLE_BUCKET,
        )

        const [search] = detailsOfType(report, "cycle-search")
        const [evaluation] = detailsOfType(report, "selector-evaluation")
        if (search === undefined || evaluation === undefined) {
            throw new Error("Missing negative-edge diagnostics")
        }
        expect(search).toMatchObject({
            site: "new-edge-proof",
            host: "committed",
            start: {
                kind: "state",
                name: "negative-edge/child",
            },
            target: {
                kind: "state",
                name: "negative-edge/root",
            },
            visits: 0,
            found: false,
            reverseProof: {
                outcome: "terminal",
                nodeVisits: 0,
                dependentProbes: 0,
            },
            evaluationGraphVersionDelta: 0,
            evaluationAttributedPublicationDelta: 0,
            acceptedPrefixLength: 1,
            parentWasCold: false,
            operationId: operation.operationId,
            commitId: operation.commitId,
            evaluationId: 1,
            searchId: 1,
        })
        expect(search.hostRef).toEqual(evaluation.hostRef)
        expect(evaluation.sessionId).toBeDefined()
        expect(search.sessionId).toBe(evaluation.sessionId as number)
    })

    test("aggregates reverse-first outcomes without per-node detail events", () => {
        const mode = atom(false, { name: "memo/mode" })
        const leaf = atom(1, { name: "memo/leaf" })
        const shared: Selector<number>[] = []
        for (let index = 63; index >= 0; index--) {
            const dependency = index === 63 ? leaf : shared[index + 1]!
            shared[index] = selector(get => get(dependency), {
                name: `memo/shared-${index}`,
            })
        }
        const sharedA = selector(get => get(shared[0]!), {
            name: "memo/shared-a",
        })
        const sharedB = selector(get => get(shared[0]!), {
            name: "memo/shared-b",
        })
        const terminalA = selector(get => get(leaf), {
            name: "memo/terminal-a",
        })
        const terminalB = selector(get => get(leaf), {
            name: "memo/terminal-b",
        })
        const { store, inspect } = createInspectableStore({
            capacity: { summaries: 1_024, details: 16_384 },
        })
        const parent = selector(
            get => {
                const expanded = get(mode)
                let sum = get(leaf)
                if (expanded) {
                    sum += inspect.span("memo proof 1", () => get(sharedA))
                    sum += inspect.span("memo proof 2", () => get(terminalA))
                    sum += inspect.span("memo proof 3", () => get(terminalB))
                    sum += inspect.span("memo proof 4", () => get(sharedB))
                }
                return sum
            },
            { name: "memo/parent" },
        )

        expect(store.get(sharedA)).toBe(1)
        expect(store.get(sharedB)).toBe(1)
        expect(store.get(terminalA)).toBe(1)
        expect(store.get(terminalB)).toBe(1)
        expect(store.get(parent)).toBe(1)
        inspect.reset()
        store.txn(transaction => transaction.set(mode, true), "memo sequence")
        expect(store.get(parent)).toBe(5)

        const report = inspect.export()
        const operation = operationNamed(report, "memo sequence")
        const expected = {
            admissionSkipped: 0,
            observing: 0,
            consultedNoPrune: 0,
            consultedPruned: 0,
            disabled: 0,
            mapProbes: 0,
            prunedNodes: 0,
            resets: { graphVersion: 0 },
            seeds: {
                initial: 0,
                activationReplacement: 0,
                secondary: 0,
                hitDerived: 0,
            },
            disables: {
                missBudget: 0,
                oversizedHitApproach: 0,
                passiveProbeBudget: 0,
            },
            retained: { maxEntries: 0 },
        }
        expect(operation.totals.cycle).toMatchObject({
            searches: 4,
            visits: 0,
            newEdgeProofMemo: expected,
            reverseProof: {
                terminal: 2,
                proven: 2,
                nodeVisits: 2,
                dependentProbes: 0,
                maxWork: 1,
                maxFrontier: 1,
            },
        })
        const evaluation = detailsOfType(report, "selector-evaluation").find(
            detail => detail.selector.name === "memo/parent",
        )
        expect(evaluation?.newEdgeProofMemo).toBeUndefined()
        const spanOutcomes = [
            ["memo proof 1", "proven"],
            ["memo proof 2", "terminal"],
            ["memo proof 3", "terminal"],
            ["memo proof 4", "proven"],
        ] as const
        for (const [name, outcome] of spanOutcomes) {
            const span = spanNamed(report, name)
            expect(span.totals.cycle.bySite.newEdgeProof).toBe(1)
            expect(span.totals.cycle.reverseProof[outcome]).toBe(1)
        }
        expect(detailsOfType(report, "cycle-search")).toHaveLength(4)
    })

    test("attributes reverse proofs across same-session graph publications", () => {
        const childCount = 6
        const source = atom(0, { name: "cross-version/source" })
        const leaf = atom(1, { name: "cross-version/leaf" })
        const shared: Selector<number>[] = []
        for (let index = 39; index >= 0; index--) {
            const dependency = index === 39 ? leaf : shared[index + 1]!
            shared[index] = selector(get => get(dependency), {
                name: `cross-version/shared/${index}`,
            })
        }
        const children = Array.from({ length: childCount }, (_, index) =>
            selector(get => (get(source) === 0 ? 0 : get(shared[0]!)), {
                name: `cross-version/child/${index}`,
            }),
        )
        const parent = selector(
            get => {
                if (get(source) === 0) return 0
                return children.reduce((sum, child) => sum + get(child), 0)
            },
            { name: "cross-version/parent" },
        )
        const { store, inspect } = createInspectableStore({
            capacity: { summaries: 1_024, details: 16_384 },
        })

        // Register the parent first so its active evaluation observes each
        // child's newly published selector edge under the same session.
        expect(store.get(parent)).toBe(0)
        expect(store.get(shared[0]!)).toBe(1)
        for (const child of children) expect(store.get(child)).toBe(0)
        const unsubscribe = store.sub(parent, () => {})
        inspect.reset()

        store.txn(
            transaction => transaction.set(source, 1),
            "cross-version memo",
        )

        expect(store.get(parent)).toBe(childCount)
        const report = inspect.export()
        const operation = operationNamed(report, "cross-version memo")
        const evaluation = detailsOfType(report, "selector-evaluation").find(
            detail => detail.selector.name === "cross-version/parent",
        )
        const parentSearches = detailsOfType(report, "cycle-search").filter(
            detail =>
                detail.site === "new-edge-proof" &&
                referenceName(detail.target) === "cross-version/parent",
        )

        expect(parentSearches.map(search => search.visits)).toEqual([
            0, 0, 0, 0, 0, 0,
        ])
        expect(
            parentSearches.every(
                search => search.reverseProof?.outcome === "proven",
            ),
        ).toBe(true)
        expect(evaluation?.newEdgeProofMemo).toBeUndefined()
        expect(
            operation.totals.cycle.reverseProof.proven,
        ).toBeGreaterThanOrEqual(childCount)
        expect(operation.totals.cycle.bySite.topologyDeltaProof).toBe(0)
        unsubscribe()
    })

    test("reports deep-equal owner replacement as zero changed sources", () => {
        const initial = { id: 1, nested: { ready: true } }
        const value = atom(initial, {
            name: "deep-equal/value",
            equal: deepEqual,
        })
        const { store, inspect } = createInspectableStore()
        let callbacks = 0

        expect(store.get(value)).toBe(initial)
        const unsubscribe = store.sub(value, () => callbacks++)
        inspect.reset()

        store.txn(
            transaction =>
                transaction.set(value, {
                    id: 1,
                    nested: { ready: true },
                }),
            "deep-equal no-op",
        )

        const report = inspect.export()
        const operation = operationNamed(report, "deep-equal no-op")
        const commit = report.summaries.find(
            summary =>
                summary.type === "commit" &&
                summary.commitId === operation.commitId,
        )

        expect(callbacks).toBe(0)
        expect(store.get(value)).toBe(initial)
        expect(operation).toMatchObject({
            effect: "committed",
            totals: {
                propagationSettled: 0,
                notificationTargets: 0,
                subscriberCallbacks: 0,
            },
        })
        expect(commit).toMatchObject({
            intents: 1,
            changedSources: 0,
            ownershipChanged: true,
            sourceApplied: true,
            notificationsCompleted: true,
        })
        unsubscribe()
    })

    test("keeps one State identity across atom intents and cycle endpoints", () => {
        const enabled = atom(false, { name: "state-identity/enabled" })
        const leaf = atom(1, { name: "state-identity/leaf" })
        const root = selector(get => (get(enabled) ? get(leaf) : 0), {
            name: "state-identity/root",
        })
        const { store, inspect } = createInspectableStore()

        expect(store.get(root)).toBe(0)
        inspect.reset()
        store.set(leaf, 2)
        store.txn(
            transaction => transaction.set(enabled, true),
            "read atom edge",
        )

        const report = inspect.export()
        const directSet = report.summaries.find(
            (summary): summary is OperationInspection =>
                summary.type === "operation" && summary.operation === "set",
        )
        const intent = detailsOfType(report, "intent").find(
            detail => detail.operationId === directSet?.operationId,
        )
        const search = detailsOfType(report, "cycle-search").find(
            detail =>
                detail.operationId ===
                operationNamed(report, "read atom edge").operationId,
        )
        if (intent === undefined || search === undefined) {
            throw new Error("Missing State identity diagnostics")
        }

        expect(intent.atom.kind).toBe("atom")
        expect(intent.atom.name).toBe("state-identity/leaf")
        expect(search.start).toMatchObject({ kind: "state" })
        expect((search.start as { id?: number }).id).toBe(intent.atom.id)
    })

    test("attributes cached transaction reads to one scratch host and pins scratch cycle walks to zero", () => {
        const leaf = atom(2, { name: "scratch/leaf" })
        const child = selector(get => get(leaf) + 1, {
            name: "scratch/child",
        })
        const root = selector(get => get(child) * 2, {
            name: "scratch/root",
        })
        const { store, inspect } = createInspectableStore()

        expect(
            store.txn(
                transaction => [transaction.get(root), transaction.get(root)],
                "scratch read",
            ),
        ).toEqual([6, 6])

        const report = inspect.export()
        const operation = operationNamed(report, "scratch read")
        const evaluations = detailsOfType(report, "selector-evaluation")

        expect(operation).toMatchObject({
            effect: "none",
            result: "returned",
            totals: {
                selectorEvaluations: 2,
                proposedTopologyChanges: 2,
                proposedTopologyIdentical: 0,
                transientSelectorHostsCreated: 1,
                cycle: { searches: 0, visits: 0, found: 0 },
            },
        })
        expect("commitId" in operation).toBe(false)
        expect(evaluations).toHaveLength(2)
        expect(
            evaluations.map(detail => referenceName(detail.selector)).sort(),
        ).toEqual(["scratch/child", "scratch/root"])
        expect(
            evaluations.every(
                detail =>
                    detail.host === "scratch" &&
                    detail.operationId === operation.operationId &&
                    detail.commitId === undefined &&
                    typeof detail.sessionId === "number",
            ),
        ).toBe(true)

        // A public transaction scratch host is generation-local and cold. Its
        // nested publications are attributed to the same evaluation session,
        // so this acyclic graph reaches neither full DFS call site.
        expect(operation.totals.cycle.byLane.scratch).toEqual({
            prefixRevalidation: EMPTY_CYCLE_BUCKET,
            newEdgeProof: EMPTY_CYCLE_BUCKET,
            topologyDeltaProof: EMPTY_CYCLE_BUCKET,
        })
        expect(detailsOfType(report, "cycle-search")).toEqual([])
    })

    test("attributes counter work to each summary interval's actual lifetime", () => {
        const source = atom(1, { name: "interval-counters/source" })
        const derived = selector(get => get(source) * 2, {
            name: "interval-counters/derived",
        })
        const { store, inspect } = createInspectableStore()

        store.txn(transaction => {
            expect(
                inspect.span("scratch phase", () => transaction.get(derived)),
            ).toBe(2)
            transaction.set(source, 2)
        }, "read then write")

        const report = inspect.export()
        const operation = operationNamed(report, "read then write")
        const span = spanNamed(report, "scratch phase")
        const commit = report.summaries.find(
            summary =>
                summary.type === "commit" &&
                summary.commitId === operation.commitId,
        )

        expect(operation.totals).toMatchObject({
            transientSelectorHostsCreated: 1,
            selectorEvaluations: 1,
        })
        expect(span.totals).toMatchObject({
            transientSelectorHostsCreated: 1,
            selectorEvaluations: 1,
        })
        expect(commit?.totals).toMatchObject({
            transientSelectorHostsCreated: 0,
            selectorEvaluations: 0,
        })
    })

    test("distinguishes committed selector graphs by scope identity", () => {
        const enabled = atom(false, { name: "scope-graphs/enabled" })
        const leaf = atom(1, { name: "scope-graphs/leaf" })
        const child = selector(get => get(leaf), {
            name: "scope-graphs/child",
        })
        const root = selector(get => (get(enabled) ? get(child) : 0), {
            name: "scope-graphs/root",
        })
        const { store, inspect } = createInspectableStore()
        const left = store.scope("left graph")
        const right = store.scope("right graph")

        for (const scope of [left, right]) {
            expect(scope.get(child)).toBe(1)
            expect(scope.get(root)).toBe(0)
        }
        inspect.reset()

        left.txn(transaction => transaction.set(enabled, true), "left rewire")
        right.txn(transaction => transaction.set(enabled, true), "right rewire")

        const report = inspect.export()
        const leftOperation = operationNamed(report, "left rewire")
        const rightOperation = operationNamed(report, "right rewire")
        const searchFor = (operation: OperationInspection) =>
            detailsOfType(report, "cycle-search").find(
                detail => detail.operationId === operation.operationId,
            )
        const leftSearch = searchFor(leftOperation)
        const rightSearch = searchFor(rightOperation)

        expect(leftSearch?.hostRef).toMatchObject({
            kind: "scope",
            name: "left graph",
        })
        expect(rightSearch?.hostRef).toMatchObject({
            kind: "scope",
            name: "right graph",
        })
        expect(leftSearch?.hostRef.id).not.toBe(rightSearch?.hostRef.id)
    })

    test("attributes disposable adapter evaluation to hydration and pins its cold cycle walks to zero", () => {
        const leaf = atom(3, { name: "hydration/leaf" })
        const child = selector(get => get(leaf) + 1, {
            name: "hydration/child",
        })
        const root = selector(get => get(child) * 2, {
            name: "hydration/root",
        })
        const { store, inspect } = createInspectableStore()

        expect(
            inspect.span("hydrate selector", () =>
                readHydrationSnapshot(store, root),
            ),
        ).toBe(8)

        const report = inspect.export()
        const span = spanNamed(report, "hydrate selector")
        const evaluations = detailsOfType(report, "selector-evaluation")

        expect(span.totals).toMatchObject({
            selectorEvaluations: 2,
            proposedTopologyChanges: 2,
            transientSelectorHostsCreated: 1,
            cycle: { searches: 0, visits: 0, found: 0 },
        })
        expect(evaluations).toHaveLength(2)
        expect(
            evaluations.map(detail => referenceName(detail.selector)).sort(),
        ).toEqual(["hydration/child", "hydration/root"])
        expect(
            evaluations.every(
                detail =>
                    detail.host === "hydration" &&
                    detail.spanId === span.spanId &&
                    detail.operationId === undefined &&
                    detail.commitId === undefined &&
                    typeof detail.sessionId === "number",
            ),
        ).toBe(true)

        // Hydration uses a fresh disposable host, so an ordinary cold DAG only
        // takes attributed-publication fast paths and performs no full search.
        expect(span.totals.cycle.byLane.hydration).toEqual({
            prefixRevalidation: EMPTY_CYCLE_BUCKET,
            newEdgeProof: EMPTY_CYCLE_BUCKET,
            topologyDeltaProof: EMPTY_CYCLE_BUCKET,
        })
        expect(detailsOfType(report, "cycle-search")).toEqual([])
    })

    test("records the exact positive committed search path once", () => {
        const enabled = atom(false, { name: "positive-cycle/enabled" })
        let left: Selector<number>
        let right: Selector<number>
        left = selector(get => (get(enabled) ? get(right) : 0), {
            name: "positive-cycle/left",
        })
        right = selector(get => get(left) + 1, {
            name: "positive-cycle/right",
        })
        const { store, inspect } = createInspectableStore()

        expect(store.get(left)).toBe(0)
        expect(store.get(right)).toBe(1)
        store.txn(
            transaction => transaction.set(enabled, true),
            "close positive cycle",
        )
        expect(() => store.get(left)).toThrow(SelectorCircularDependencyError)

        const report = inspect.export()
        const operation = operationNamed(report, "close positive cycle")
        const searches = detailsOfType(report, "cycle-search")

        expect(operation.totals.cycle).toMatchObject({
            searches: 1,
            visits: 2,
            maxVisits: 2,
            found: 1,
        })
        expect(operation.totals.cycle.byLane.committed.newEdgeProof).toEqual({
            searches: 1,
            visits: 2,
            maxVisits: 2,
            found: 1,
        })
        expect(searches).toHaveLength(1)
        expect(searches[0]).toMatchObject({
            site: "new-edge-proof",
            host: "committed",
            visits: 2,
            found: true,
            start: {
                kind: "state",
                name: "positive-cycle/right",
            },
            target: {
                kind: "state",
                name: "positive-cycle/left",
            },
            path: [
                {
                    kind: "state",
                    name: "positive-cycle/right",
                },
                {
                    kind: "state",
                    name: "positive-cycle/left",
                },
            ],
            operationId: operation.operationId,
            commitId: operation.commitId,
        })
    })

    test("attributes a negative topology delta proof to the protected prefix", () => {
        const parentGate = atom(false, { name: "delta-negative/parent-gate" })
        const changedGate = atom(false, {
            name: "delta-negative/changed-gate",
        })
        const laterGate = atom(false, { name: "delta-negative/later-gate" })
        const extra = selector(() => 2, { name: "delta-negative/extra" })
        const changed = selector(get => (get(changedGate) ? get(extra) : 1), {
            name: "delta-negative/changed",
        })
        const newEdge = selector(get => get(changed), {
            name: "delta-negative/new-edge",
        })
        const stable = selector(() => 0, {
            name: "delta-negative/stable",
        })
        const parent = selector(
            get => {
                get(stable)
                return get(parentGate) ? get(newEdge) : 1
            },
            { name: "delta-negative/parent" },
        )
        const later = selector(get => (get(laterGate) ? 1 : get(changed)), {
            name: "delta-negative/later",
        })
        const { store, inspect } = createInspectableStore()

        expect(store.get(newEdge)).toBe(1)
        expect(store.get(later)).toBe(1)
        expect(store.get(parent)).toBe(1)
        inspect.reset()

        inspect.span("negative topology delta outer", () =>
            inspect.span("negative topology delta inner", () =>
                store.txn(transaction => {
                    transaction.set(parentGate, true)
                    transaction.set(changedGate, true)
                    transaction.set(laterGate, true)
                }, "negative topology delta"),
            ),
        )

        expect(store.get(parent)).toBe(2)
        const report = inspect.export()
        const operation = operationNamed(report, "negative topology delta")
        const committed = operation.totals.cycle.byLane.committed
        const proofs = detailsOfType(report, "cycle-search").filter(
            detail =>
                detail.operationId === operation.operationId &&
                detail.site === "topology-delta-proof",
        )
        const snapshot = {
            attempts: 1,
            completed: 1,
            overflow: 0,
            unavailable: 0,
            scannedActiveFrames: 1,
            scannedPrefixEdges: 2,
            maxScannedActiveFrames: 1,
            maxScannedPrefixEdges: 2,
            capturedActiveFrames: 1,
            capturedPrefixEdges: 2,
            maxCapturedActiveFrames: 1,
            maxCapturedPrefixEdges: 2,
        }
        const commit = report.summaries.find(
            summary =>
                summary.type === "commit" &&
                summary.operationId === operation.operationId,
        )
        if (commit === undefined) {
            throw new Error("Missing negative topology delta commit")
        }
        const outer = spanNamed(report, "negative topology delta outer")
        const inner = spanNamed(report, "negative topology delta inner")
        const snapshotEvaluations = detailsOfType(
            report,
            "selector-evaluation",
        ).filter(detail => detail.topologyDeltaReverseSnapshot !== undefined)

        expect(committed.topologyDeltaProof.searches).toBeGreaterThan(0)
        expect(committed.topologyDeltaProof.visits).toBe(0)
        expect(committed.topologyDeltaProof.found).toBe(0)
        expect(operation.totals.cycle.bySite.topologyDeltaProof).toBe(
            committed.topologyDeltaProof.searches,
        )
        expect(committed.prefixRevalidation).toEqual(EMPTY_CYCLE_BUCKET)
        expect(proofs).toHaveLength(committed.topologyDeltaProof.searches)
        expect(
            operation.totals.cycle.reverseProof.topologyDeltaSnapshot,
        ).toEqual(snapshot)
        expect(commit.totals.cycle.reverseProof.topologyDeltaSnapshot).toEqual(
            snapshot,
        )
        expect(outer.totals.cycle.reverseProof.topologyDeltaSnapshot).toEqual(
            snapshot,
        )
        expect(inner.totals.cycle.reverseProof.topologyDeltaSnapshot).toEqual(
            snapshot,
        )
        expect(snapshotEvaluations).toHaveLength(1)
        expect(snapshotEvaluations[0]).toMatchObject({
            selector: { name: "delta-negative/parent" },
            topologyDeltaReverseSnapshot: snapshot,
        })
        expect(
            proofs.every(
                proof =>
                    proof.acceptedPrefixLength === 2 &&
                    !proof.found &&
                    proof.visits === 0 &&
                    (proof.reverseProof?.outcome === "terminal" ||
                        proof.reverseProof?.outcome === "proven"),
            ),
        ).toBe(true)
    })

    test("records a topology delta screen before a later canonical cycle proof", () => {
        const parentGate = atom(false, { name: "delta-cycle/parent-gate" })
        const changedGate = atom(false, { name: "delta-cycle/changed-gate" })
        const laterGate = atom(false, { name: "delta-cycle/later-gate" })
        let parent!: Selector<number>
        let cached!: Selector<number>
        const changed = selector(get => (get(changedGate) ? get(cached) : 1), {
            name: "delta-cycle/changed",
        })
        const newEdge = selector(get => get(changed), {
            name: "delta-cycle/new-edge",
        })
        const stable = selector(() => 0, {
            name: "delta-cycle/stable",
        })
        parent = selector(
            get => {
                get(stable)
                return get(parentGate) ? get(newEdge) : 1
            },
            { name: "delta-cycle/parent" },
        )
        cached = selector(get => get(parent), {
            name: "delta-cycle/cached",
        })
        const later = selector(get => (get(laterGate) ? 1 : get(changed)), {
            name: "delta-cycle/later",
        })
        const { store, inspect } = createInspectableStore()

        expect(store.get(newEdge)).toBe(1)
        expect(store.get(cached)).toBe(1)
        expect(store.get(later)).toBe(1)
        inspect.reset()

        store.txn(transaction => {
            transaction.set(parentGate, true)
            transaction.set(changedGate, true)
            transaction.set(laterGate, true)
        }, "positive topology delta")

        expect(() => store.get(parent)).toThrow(SelectorCircularDependencyError)
        const report = inspect.export()
        const operation = operationNamed(report, "positive topology delta")
        const committed = operation.totals.cycle.byLane.committed
        const positiveProofs = detailsOfType(report, "cycle-search").filter(
            detail =>
                detail.operationId === operation.operationId && detail.found,
        )

        expect(committed.topologyDeltaProof).toMatchObject({
            searches: 1,
            found: 0,
        })
        expect(committed.prefixRevalidation).toEqual(EMPTY_CYCLE_BUCKET)
        expect(committed.newEdgeProof.found).toBe(1)
        expect(positiveProofs.map(proof => proof.site)).toEqual([
            "new-edge-proof",
        ])
        expect(positiveProofs[0]).toMatchObject({
            acceptedPrefixLength: 2,
            start: { kind: "state", name: "delta-cycle/new-edge" },
            target: { kind: "state", name: "delta-cycle/parent" },
            path: [
                { kind: "state", name: "delta-cycle/new-edge" },
                { kind: "state", name: "delta-cycle/changed" },
                { kind: "state", name: "delta-cycle/cached" },
                { kind: "state", name: "delta-cycle/parent" },
            ],
        })
    })

    for (const detailCapacity of [0, 1]) {
        test(`retains exact cycle summaries when detail capacity is ${detailCapacity}`, () => {
            const { store, inspect, flag } =
                prepareNegativeNewEdge(detailCapacity)

            store.txn(
                transaction => transaction.set(flag, true),
                `overflow ${detailCapacity}`,
            )

            const report = inspect.export()
            const operation = operationNamed(
                report,
                `overflow ${detailCapacity}`,
            )

            expect(operation.totals.cycle).toMatchObject({
                searches: 1,
                visits: 0,
                maxVisits: 0,
                found: 0,
                reverseProof: { terminal: 1 },
            })
            expect(
                operation.totals.cycle.byLane.committed.newEdgeProof,
            ).toEqual({
                searches: 1,
                visits: 0,
                maxVisits: 0,
                found: 0,
            })
            expect(report.details).toHaveLength(detailCapacity)
            expect(report.overflow.details).toBeGreaterThan(0)
            expect(report.complete).toBe(false)
            expect(report.overflow.retained.summaries).toMatchObject({
                firstSequence: 1,
            })
            if (detailCapacity === 0) {
                expect(report.overflow.retained.details).toBeUndefined()
            } else {
                expect(report.overflow.retained.details).toMatchObject({
                    firstSequence: expect.any(Number),
                    lastSequence: expect.any(Number),
                })
            }
        })
    }

    test("reports true retained sequence bounds for nested intervals", () => {
        const { inspect } = createInspectableStore({
            capacity: { summaries: 2, details: 0 },
        })

        inspect.span("outer", () => inspect.span("inner", () => undefined))

        const report = inspect.export()
        const firstSequence = Math.min(
            ...report.summaries.map(summary => summary.seqStart),
        )
        const lastSequence = Math.max(
            ...report.summaries.map(summary => summary.seqEnd),
        )
        expect(report.overflow.retained.summaries).toEqual({
            firstSequence,
            lastSequence,
        })
        expect(report.summaries[0]?.seqEnd).toBe(lastSequence)
        expect(report.summaries[1]?.seqEnd).toBeLessThan(lastSequence)
    })

    test("counts one propagation settlement, target, and subscriber callback", () => {
        const source = atom(1, { name: "notification/source" })
        const doubled = selector(get => get(source) * 2, {
            name: "notification/doubled",
        })
        const { store, inspect } = createInspectableStore()
        let callbacks = 0

        expect(store.get(doubled)).toBe(2)
        const unsubscribe = store.sub(doubled, () => {
            callbacks++
            expect(store.get(doubled)).toBe(4)
        })
        inspect.reset()

        store.txn(
            transaction => transaction.set(source, 2),
            "notify exactly once",
        )
        unsubscribe()

        const report = inspect.export()
        const operation = operationNamed(report, "notify exactly once")

        expect(callbacks).toBe(1)
        expect(operation).toMatchObject({
            effect: "committed",
            result: "returned",
            totals: {
                selectorEvaluations: 1,
                proposedTopologyChanges: 0,
                proposedTopologyIdentical: 1,
                transientSelectorHostsCreated: 0,
                propagationSettled: 1,
                notificationTargets: 1,
                subscriberCallbacks: 1,
                cycle: { searches: 0, visits: 0, found: 0 },
            },
        })
        expect(
            report.summaries.find(
                summary =>
                    summary.type === "commit" &&
                    summary.commitId === operation.commitId,
            ),
        ).toMatchObject({
            operationId: operation.operationId,
            intents: 1,
            changedSources: 1,
            ownershipChanged: true,
            sourceApplied: true,
            notificationsCompleted: true,
            totals: {
                propagationSettled: 1,
                notificationTargets: 1,
                subscriberCallbacks: 1,
            },
        })
    })

    test("keeps a rejected subscriber write inside the outer notification failure", () => {
        const source = atom(0, { name: "subscriber-write/source" })
        const rejected = atom(0, { name: "subscriber-write/rejected" })
        const { store, inspect } = createInspectableStore()
        const unsubscribe = store.sub(source, () => store.set(rejected, 1))
        let error: unknown

        try {
            store.set(source, 1)
        } catch (thrown) {
            error = thrown
        }

        const report = inspect.export()
        const operations = report.summaries.filter(
            (summary): summary is OperationInspection =>
                summary.type === "operation",
        )
        const intents = detailsOfType(report, "intent")

        expect(error).toMatchObject({
            code: "VALDRES_SUBSCRIBER_NOTIFICATION",
            committed: true,
            phase: "notifying",
        })
        expect(store.get(source)).toBe(1)
        expect(store.get(rejected)).toBe(0)
        expect(operations).toHaveLength(1)
        expect(operations[0]).toMatchObject({
            operation: "set",
            result: "threw",
            effect: "committed-with-notification-error",
            totals: { subscriberCallbacks: 1 },
        })
        expect(intents).toHaveLength(1)
        expect(intents[0]?.operationId).toBe(operations[0]?.operationId)
        unsubscribe()
    })

    test("attributes nested propagation publications to the active parent session", () => {
        const childCount = 6
        const source = atom(0, { name: "nested-settlement/source" })
        const children = Array.from({ length: childCount }, (_, index) =>
            selector(get => get(source), {
                name: `nested-settlement/child/${index}`,
            }),
        )
        const parent = selector(
            get => {
                if (get(source) === 0) return 0
                return children.reduce((sum, child) => sum + get(child), 0)
            },
            { name: "nested-settlement/parent" },
        )
        const { store, inspect } = createInspectableStore()

        // Register the parent first so propagation reaches it before the
        // individually materialized children. Its dynamic reads then settle
        // those dirty children while the parent evaluation is active.
        expect(store.get(parent)).toBe(0)
        for (const child of children) expect(store.get(child)).toBe(0)
        inspect.reset()

        store.txn(
            transaction => transaction.set(source, 1),
            "nested settlement",
        )

        expect(store.get(parent)).toBe(childCount)
        const report = inspect.export()
        const operation = operationNamed(report, "nested settlement")
        const evaluations = detailsOfType(report, "selector-evaluation").filter(
            detail => detail.operationId === operation.operationId,
        )

        expect(operation.totals).toMatchObject({
            selectorEvaluations: childCount + 1,
            proposedTopologyChanges: 1,
            proposedTopologyIdentical: childCount,
        })
        expect(
            operation.totals.cycle.byLane.committed.prefixRevalidation,
        ).toEqual(EMPTY_CYCLE_BUCKET)
        expect(operation.totals.cycle.byLane.committed.newEdgeProof).toEqual({
            searches: childCount,
            visits: 0,
            maxVisits: 0,
            found: 0,
        })
        expect(operation.totals.cycle.reverseProof.terminal).toBe(childCount)
        expect(evaluations).toHaveLength(childCount + 1)
        expect(new Set(evaluations.map(detail => detail.sessionId)).size).toBe(
            1,
        )
    })

    test("captures a modest ShiftX-shaped cold first named drop", () => {
        const itemCount = 18
        const sequenceCount = 3
        const viewsPerItem = 2
        const { store, inspect } = createInspectableStore()
        const process = store.scope("shiftx-process")
        const entities = Array.from({ length: itemCount }, (_, index) =>
            atom(
                {
                    id: index,
                    sequence: index % sequenceCount,
                    order: index,
                },
                { name: `shiftx/entity/${index}` },
            ),
        )
        const orders = Array.from({ length: sequenceCount }, (_, sequence) =>
            selector(
                get =>
                    entities
                        .map((entity, index) => ({
                            index,
                            value: get(entity),
                        }))
                        .filter(entry => entry.value.sequence === sequence)
                        .sort(
                            (left, right) =>
                                left.value.order - right.value.order,
                        )
                        .map(entry => entry.index),
                { name: `shiftx/order/${sequence}` },
            ),
        )
        const chains = new Map<number, Selector<number>>()
        const chain = (index: number): Selector<number> => {
            const current = chains.get(index)
            if (current !== undefined) return current
            const created = selector(
                get => {
                    const entity = get(entities[index]!)
                    const order = get(orders[entity.sequence]!)
                    const position = order.indexOf(index)
                    const predecessor =
                        position > 0 ? order[position - 1] : undefined
                    return (
                        entity.id +
                        (predecessor === undefined
                            ? 0
                            : get(chain(predecessor)))
                    )
                },
                { name: `shiftx/chain/${index}` },
            )
            chains.set(index, created)
            return created
        }
        const views = Array.from({ length: itemCount }, (_, index) =>
            Array.from({ length: viewsPerItem }, (_, view) =>
                selector(get => get(chain(index)) * 10 + view, {
                    name: `shiftx/view/${index}/${view}`,
                }),
            ),
        )
        const unsubscribes: (() => void)[] = []
        let notifications = 0

        inspect.span("shiftx materialize", () => {
            for (const itemViews of views) {
                for (const view of itemViews) {
                    process.get(view)
                    unsubscribes.push(
                        process.sub(view, () => {
                            notifications++
                            process.get(view)
                        }),
                    )
                }
            }
        })

        process.txn(transaction => {
            const scoped = transaction.scope(process)
            const entity = scoped.get(entities[7]!)
            scoped.set(entities[7]!, {
                ...entity,
                sequence: 2,
                order: 1_007,
            })
        }, "shiftx cold first drop")

        let checksum = 0
        for (const itemViews of views) {
            for (const view of itemViews) checksum += process.get(view)
        }
        for (const unsubscribe of unsubscribes) unsubscribe()

        const report = inspect.export()
        const operation = operationNamed(report, "shiftx cold first drop")
        const cycle = operation.totals.cycle
        const searches = detailsOfType(report, "cycle-search").filter(
            detail => detail.operationId === operation.operationId,
        )

        expect(checksum).toBe(8_198)
        expect(notifications).toBe(8)
        expect(cycle.searches).toBeGreaterThan(0)
        expect(
            cycle.reverseProof.terminal +
                cycle.reverseProof.proven +
                cycle.reverseProof.pathPossible +
                cycle.reverseProof.budgetExhausted +
                cycle.reverseProof.disabled +
                cycle.reverseProof.activeFrames +
                cycle.reverseProof.unsupported,
        ).toBe(cycle.bySite.newEdgeProof + cycle.bySite.topologyDeltaProof)
        expect(cycle.found).toBe(0)
        expect(cycle.byLane.committed.prefixRevalidation).toEqual(
            EMPTY_CYCLE_BUCKET,
        )
        expect(cycle.byLane.committed.topologyDeltaProof).toEqual(
            EMPTY_CYCLE_BUCKET,
        )
        expect(cycle.byLane.committed.newEdgeProof.searches).toBeGreaterThan(0)
        expect(cycle.byHost).toEqual({
            committed: cycle.searches,
            scratch: 0,
            hydration: 0,
        })
        expect(searches).toHaveLength(cycle.searches)
        expect(
            searches.every(
                detail =>
                    detail.host === "committed" &&
                    detail.found === false &&
                    detail.operationId === operation.operationId &&
                    detail.commitId === operation.commitId &&
                    typeof detail.evaluationId === "number" &&
                    typeof detail.searchId === "number" &&
                    referenceName(detail.target) !== undefined,
            ),
        ).toBe(true)
        expect(
            searches.some(detail => referenceName(detail.start) !== undefined),
        ).toBe(true)
        expect(searches.every(detail => detail.site === "new-edge-proof")).toBe(
            true,
        )
        expect(searches.some(detail => detail.site === "new-edge-proof")).toBe(
            true,
        )
        expect(
            searches.every(
                detail =>
                    detail.evaluationGraphVersionDelta >= 0 &&
                    detail.evaluationAttributedPublicationDelta >= 0 &&
                    detail.acceptedPrefixLength >= 0,
            ),
        ).toBe(true)
        expect(operation.totals.selectorEvaluations).toBeGreaterThan(0)
        expect(operation.totals.proposedTopologyChanges).toBeGreaterThan(0)
        expect(
            operation.totals.proposedTopologyChanges +
                operation.totals.proposedTopologyIdentical,
        ).toBe(operation.totals.selectorEvaluations)
        expect(operation.totals.propagationSettled).toBeGreaterThan(0)
        expect(operation.totals.notificationTargets).toBe(notifications)
        expect(operation.totals.subscriberCallbacks).toBe(notifications)
        expectJsonRoundTrip(report)
    })

    test("partitions completed, overflow, and unavailable reverse snapshot work", () => {
        const setup = createInspectionRecorder()
        const span = setup.recorder.beginInterval({
            type: "span",
            name: "snapshot aggregation",
        })

        setup.recorder.addWork({
            cycle: {
                topologyDeltaReverseSnapshot: {
                    outcome: "completed",
                    scannedFrames: 3,
                    activeFrames: 2,
                    prefixEdges: 3,
                },
            },
        })
        setup.recorder.addWork({
            cycle: {
                topologyDeltaReverseSnapshot: {
                    outcome: "overflow",
                    scannedFrames: 5,
                    activeFrames: 4,
                    prefixEdges: 4_097,
                },
            },
        })
        setup.recorder.addWork({
            cycle: {
                topologyDeltaReverseSnapshot: {
                    outcome: "unavailable",
                    scannedFrames: 2,
                    activeFrames: 1,
                    prefixEdges: 7,
                },
            },
        })
        setup.recorder.finishInterval(span, { result: "returned" })

        const report = setup.inspect.export()
        const snapshot = spanNamed(report, "snapshot aggregation").totals.cycle
            .reverseProof.topologyDeltaSnapshot

        expect(snapshot).toEqual({
            attempts: 3,
            completed: 1,
            overflow: 1,
            unavailable: 1,
            scannedActiveFrames: 10,
            scannedPrefixEdges: 4_107,
            maxScannedActiveFrames: 5,
            maxScannedPrefixEdges: 4_097,
            capturedActiveFrames: 2,
            capturedPrefixEdges: 3,
            maxCapturedActiveFrames: 2,
            maxCapturedPrefixEdges: 3,
        })
        expect(
            snapshot.completed + snapshot.overflow + snapshot.unavailable,
        ).toBe(snapshot.attempts)
    })
})
