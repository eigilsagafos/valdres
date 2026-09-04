import { describe, expect, test } from "bun:test"
import type {
    CollectionEffectiveDeltaInspectionDetail,
    CollectionMembershipInspectionDetail,
    CollectionSourceInspectionDetail,
    InspectionDetail,
    InspectionReference,
    OperationInspection,
} from "../../src/inspect"
import {
    deterministicCollectionPrograms,
    generateCollectionProgram,
    type CollectionProgram,
} from "../v1-model/collection-programs"
import { createReferenceModel } from "../v1-model/model"
import type {
    AuditEvent,
    Command,
    CommandResult,
    EffectiveRowDelta,
    ObservableEvent,
    ReadOutcome,
    TargetRef,
} from "../v1-model/protocol"
import {
    createCollectionRuntimeDriver,
    type CollectionRuntimeDriver,
    type RuntimeCommandExecution,
    type RuntimeCommandResult,
    type RuntimeObservableEvent,
    type RuntimeReadOutcome,
} from "./collection-differential-runtime"

type SubscriptionSpec = Readonly<{
    scope: string
    target: TargetRef
}>

type SnapshotPair = Readonly<{
    model: number | string
    runtime: readonly unknown[]
    label: string
}>

type StructuralEffectiveDelta = Readonly<{
    scope: string
    collection: string
    row: string
    change: "insert" | "update" | "remove"
    before: "absent" | "present"
    after: "absent" | "present"
    membership: "insert" | "remove" | "unchanged"
}>

type StructuralMembershipDelta = Readonly<{
    scope: string
    collection: string
    row: string
    change: "insert" | "remove"
}>

type StructuralSource = Readonly<{
    scope: string
    collection: string
    source: "row" | "membership"
    row?: string
}>

const structuralOrder = <Value>(values: readonly Value[]): readonly Value[] =>
    [...values].sort((left, right) =>
        JSON.stringify(left).localeCompare(JSON.stringify(right)),
    )

const normalizeOutcome = (
    outcome: ReadOutcome | RuntimeReadOutcome,
): unknown =>
    outcome.kind === "rows"
        ? { kind: "rows", rows: [...outcome.rows] }
        : outcome

const normalizeResult = (
    result: CommandResult | RuntimeCommandResult,
): unknown => ({
    ...result,
    ...(result.outcome === undefined
        ? {}
        : { outcome: normalizeOutcome(result.outcome) }),
})

const normalizeTraceEvent = (
    event: ObservableEvent | RuntimeObservableEvent,
): unknown => {
    if (event.kind === "read") {
        return { ...event, outcome: normalizeOutcome(event.outcome) }
    }
    if (event.kind === "notification-observation") {
        return {
            ...event,
            reads: event.reads.map(read => ({
                ...read,
                outcome: normalizeOutcome(read.outcome),
            })),
        }
    }
    return event
}

const isNotificationEvent = (
    event: ObservableEvent | RuntimeObservableEvent,
): event is Extract<
    ObservableEvent | RuntimeObservableEvent,
    { kind: "notifications" }
> => event.kind === "notifications"

const isObservationEvent = (
    event: ObservableEvent | RuntimeObservableEvent,
): event is Extract<
    ObservableEvent | RuntimeObservableEvent,
    { kind: "notification-observation" }
> => event.kind === "notification-observation"

const nativeRootSubscription = (
    id: string,
    rootScope: string | undefined,
    subscriptions: ReadonlyMap<string, SubscriptionSpec>,
): boolean => {
    const subscription = subscriptions.get(id)
    return (
        subscription !== undefined &&
        subscription.scope === rootScope &&
        subscription.target.kind !== "presence"
    )
}

const normalizeNotifications = (
    subscriptions: readonly string[],
    rootScope: string | undefined,
    specs: ReadonlyMap<string, SubscriptionSpec>,
) => ({
    native: subscriptions.filter(id =>
        nativeRootSubscription(id, rootScope, specs),
    ),
    projected: subscriptions
        .filter(id => !nativeRootSubscription(id, rootScope, specs))
        .sort(),
})

const collectSnapshotPair = (
    model: ReadOutcome,
    runtime: RuntimeReadOutcome,
    label: string,
    pairs: SnapshotPair[],
): void => {
    if (model.kind !== "rows") return
    if (runtime.kind !== "rows") {
        throw new Error(`${label}: runtime outcome is not a membership read`)
    }
    if (!Object.isFrozen(runtime.snapshot)) {
        throw new Error(`${label}: runtime membership array is not frozen`)
    }
    pairs.push({ model: model.snapshot, runtime: runtime.snapshot, label })
}

const compareTraceSlice = (
    modelTrace: readonly ObservableEvent[],
    runtimeTrace: readonly RuntimeObservableEvent[],
    rootScope: string | undefined,
    subscriptions: ReadonlyMap<string, SubscriptionSpec>,
    snapshots: SnapshotPair[],
): void => {
    const modelMain = modelTrace.filter(
        event => !isNotificationEvent(event) && !isObservationEvent(event),
    )
    const runtimeMain = runtimeTrace.filter(
        event => !isNotificationEvent(event) && !isObservationEvent(event),
    )
    expect(runtimeMain.map(normalizeTraceEvent)).toEqual(
        modelMain.map(normalizeTraceEvent),
    )
    for (let index = 0; index < modelMain.length; index++) {
        const modelEvent = modelMain[index]!
        const runtimeEvent = runtimeMain[index]!
        if (modelEvent.kind === "read" && runtimeEvent.kind === "read") {
            collectSnapshotPair(
                modelEvent.outcome,
                runtimeEvent.outcome,
                `trace read ${modelEvent.as}`,
                snapshots,
            )
        }
    }

    const modelObservations = modelTrace
        .filter(
            (
                event,
            ): event is Extract<
                ObservableEvent,
                { kind: "notification-observation" }
            > => event.kind === "notification-observation",
        )
        .sort((left, right) =>
            left.subscription.localeCompare(right.subscription),
        )
    const runtimeObservations = runtimeTrace
        .filter(
            (
                event,
            ): event is Extract<
                RuntimeObservableEvent,
                { kind: "notification-observation" }
            > => event.kind === "notification-observation",
        )
        .sort((left, right) =>
            left.subscription.localeCompare(right.subscription),
        )
    expect(runtimeObservations.map(normalizeTraceEvent)).toEqual(
        modelObservations.map(normalizeTraceEvent),
    )
    for (let index = 0; index < modelObservations.length; index++) {
        const modelEvent = modelObservations[index]!
        const runtimeEvent = runtimeObservations[index]!
        for (
            let readIndex = 0;
            readIndex < modelEvent.reads.length;
            readIndex++
        ) {
            collectSnapshotPair(
                modelEvent.reads[readIndex]!.outcome,
                runtimeEvent.reads[readIndex]!.outcome,
                `notification ${modelEvent.subscription}:${modelEvent.reads[readIndex]!.as}`,
                snapshots,
            )
        }
    }

    const modelNotifications = modelTrace.filter(isNotificationEvent)
    const runtimeNotifications = runtimeTrace.filter(isNotificationEvent)
    expect(runtimeNotifications).toHaveLength(modelNotifications.length)
    for (let index = 0; index < modelNotifications.length; index++) {
        expect(
            normalizeNotifications(
                runtimeNotifications[index]!.subscriptions,
                rootScope,
                subscriptions,
            ),
        ).toEqual(
            normalizeNotifications(
                modelNotifications[index]!.subscriptions,
                rootScope,
                subscriptions,
            ),
        )
    }
}

const requiredId = (
    kind: string,
    reference: InspectionReference,
    resolve: (reference: InspectionReference) => string | undefined,
): string => {
    const id = resolve(reference)
    if (id === undefined) {
        throw new Error(`Unmapped ${kind} inspection reference ${reference.id}`)
    }
    return id
}

const rowAuthorityKey = (scope: string, row: string): string =>
    JSON.stringify([scope, row])

const membershipAuthorityKey = (scope: string, collection: string): string =>
    JSON.stringify([scope, collection])

const pruneDisposedAuthorities = (
    authorities: ReadonlySet<string>,
    disposed: ReadonlySet<string>,
): Set<string> =>
    new Set(
        [...authorities].filter(authority => {
            const [scope] = JSON.parse(authority) as [string, string]
            return !disposed.has(scope)
        }),
    )

const sourceMaterialization = (
    detail: InspectionDetail,
    driver: CollectionRuntimeDriver,
):
    | Readonly<{
          source: "row"
          scope: string
          row: string
          collection: string
      }>
    | Readonly<{
          source: "membership"
          scope: string
          collection: string
      }>
    | undefined => {
    if (
        detail.type !== "collection-source" ||
        detail.action !== "materialized"
    ) {
        return undefined
    }
    const scope = requiredId("scope", detail.scope, reference =>
        driver.scopeId(reference),
    )
    if (detail.source === "membership") {
        return {
            source: "membership",
            scope,
            collection: requiredId("collection", detail.state, reference =>
                driver.collectionId(reference),
            ),
        }
    }
    if (detail.collection === undefined) {
        throw new Error("Row materialization omitted its collection reference")
    }
    return {
        source: "row",
        scope,
        row: requiredId("row", detail.state, reference =>
            driver.rowId(reference),
        ),
        collection: requiredId("collection", detail.collection, reference =>
            driver.collectionId(reference),
        ),
    }
}

const effectiveShape = (delta: EffectiveRowDelta): StructuralEffectiveDelta => {
    const change =
        delta.before.kind === "absent"
            ? "insert"
            : delta.after.kind === "absent"
              ? "remove"
              : "update"
    return {
        scope: delta.scope,
        collection: delta.collection,
        row: delta.row,
        change,
        before: delta.before.kind,
        after: delta.after.kind,
        membership: delta.membership,
    }
}

const runtimeEffectiveShape = (
    detail: CollectionEffectiveDeltaInspectionDetail,
    driver: CollectionRuntimeDriver,
): StructuralEffectiveDelta => ({
    scope: requiredId("scope", detail.scope, reference =>
        driver.scopeId(reference),
    ),
    collection: requiredId("collection", detail.collection, reference =>
        driver.collectionId(reference),
    ),
    row: requiredId("row", detail.row, reference => driver.rowId(reference)),
    change: detail.change,
    before: detail.before,
    after: detail.after,
    membership: detail.membership,
})

const runtimeMembershipShape = (
    detail: CollectionMembershipInspectionDetail,
    driver: CollectionRuntimeDriver,
): StructuralMembershipDelta => ({
    scope: requiredId("scope", detail.scope, reference =>
        driver.scopeId(reference),
    ),
    collection: requiredId("collection", detail.collection, reference =>
        driver.collectionId(reference),
    ),
    row: requiredId("row", detail.row, reference => driver.rowId(reference)),
    change: detail.change,
})

const runtimePublishedSource = (
    detail: CollectionSourceInspectionDetail,
    driver: CollectionRuntimeDriver,
): StructuralSource | undefined => {
    if (detail.action !== "published") return undefined
    const scope = requiredId("scope", detail.scope, reference =>
        driver.scopeId(reference),
    )
    if (detail.source === "membership") {
        return {
            scope,
            collection: requiredId("collection", detail.state, reference =>
                driver.collectionId(reference),
            ),
            source: "membership",
        }
    }
    if (detail.collection === undefined) {
        throw new Error("Published row source omitted its collection reference")
    }
    return {
        scope,
        collection: requiredId("collection", detail.collection, reference =>
            driver.collectionId(reference),
        ),
        source: "row",
        row: requiredId("row", detail.state, reference =>
            driver.rowId(reference),
        ),
    }
}

const compareStructuralInspection = (
    audit: readonly AuditEvent[],
    execution: RuntimeCommandExecution,
    driver: CollectionRuntimeDriver,
    priorRows: ReadonlySet<string>,
    priorMemberships: ReadonlySet<string>,
): Readonly<{
    rows: ReadonlySet<string>
    memberships: ReadonlySet<string>
}> => {
    const currentRows = new Set(priorRows)
    const currentMemberships = new Set(priorMemberships)
    const materializations = execution.details
        .map(detail => sourceMaterialization(detail, driver))
        .filter(materialization => materialization !== undefined)
    for (const detail of execution.details) {
        const materialization = sourceMaterialization(detail, driver)
        if (materialization === undefined || detail.commitId !== undefined) {
            continue
        }
        if (materialization.source === "row") {
            currentRows.add(
                rowAuthorityKey(materialization.scope, materialization.row),
            )
        } else {
            currentMemberships.add(
                membershipAuthorityKey(
                    materialization.scope,
                    materialization.collection,
                ),
            )
        }
    }

    const commits = audit.filter(
        (event): event is Extract<AuditEvent, { kind: "commit" }> =>
            event.kind === "commit",
    )
    const deltas = commits.flatMap(commit => commit.collectionDeltas)
    const membershipChanges = commits.flatMap(
        commit => commit.membershipChanges,
    )

    const expectedEffective = deltas
        .filter(delta =>
            currentRows.has(rowAuthorityKey(delta.scope, delta.row)),
        )
        .map(effectiveShape)
    const actualEffective = execution.details
        .filter(
            (detail): detail is CollectionEffectiveDeltaInspectionDetail =>
                detail.type === "collection-effective-delta",
        )
        .map(detail => runtimeEffectiveShape(detail, driver))
    expect(structuralOrder(actualEffective)).toEqual(
        structuralOrder(expectedEffective),
    )

    const expectedMembership = deltas
        .filter(
            delta =>
                delta.membership !== "unchanged" &&
                currentMemberships.has(
                    membershipAuthorityKey(delta.scope, delta.collection),
                ),
        )
        .map<StructuralMembershipDelta>(delta => ({
            scope: delta.scope,
            collection: delta.collection,
            row: delta.row,
            change: delta.membership as "insert" | "remove",
        }))
    const actualMembership = execution.details
        .filter(
            (detail): detail is CollectionMembershipInspectionDetail =>
                detail.type === "collection-membership",
        )
        .map(detail => runtimeMembershipShape(detail, driver))
    expect(structuralOrder(actualMembership)).toEqual(
        structuralOrder(expectedMembership),
    )

    const expectedSources: StructuralSource[] = [
        ...deltas
            .filter(delta =>
                currentRows.has(rowAuthorityKey(delta.scope, delta.row)),
            )
            .map(delta => ({
                scope: delta.scope,
                collection: delta.collection,
                source: "row" as const,
                row: delta.row,
            })),
        ...membershipChanges
            .filter(
                change =>
                    change.sourceChanged &&
                    currentMemberships.has(
                        membershipAuthorityKey(change.scope, change.collection),
                    ),
            )
            .map(change => ({
                scope: change.scope,
                collection: change.collection,
                source: "membership" as const,
            })),
    ]
    const actualSources = execution.details
        .filter(
            (detail): detail is CollectionSourceInspectionDetail =>
                detail.type === "collection-source",
        )
        .map(detail => runtimePublishedSource(detail, driver))
        .filter(source => source !== undefined)
    expect(structuralOrder(actualSources)).toEqual(
        structuralOrder(expectedSources),
    )

    const nextRows = new Set(priorRows)
    const nextMemberships = new Set(priorMemberships)
    for (const materialization of materializations) {
        if (materialization.source === "row") {
            nextRows.add(
                rowAuthorityKey(materialization.scope, materialization.row),
            )
        } else {
            nextMemberships.add(
                membershipAuthorityKey(
                    materialization.scope,
                    materialization.collection,
                ),
            )
        }
    }
    return { rows: nextRows, memberships: nextMemberships }
}

const assertSnapshotEquivalence = (pairs: readonly SnapshotPair[]): void => {
    for (let first = 0; first < pairs.length; first++) {
        for (let second = 0; second < pairs.length; second++) {
            expect(
                Object.is(pairs[first]!.runtime, pairs[second]!.runtime),
            ).toBe(Object.is(pairs[first]!.model, pairs[second]!.model))
        }
    }
}

const losslessJson = (value: unknown): string =>
    JSON.stringify(
        value,
        (_key, current) => {
            if (typeof current === "bigint") {
                return { $special: "bigint", value: current.toString() }
            }
            if (typeof current === "number") {
                if (Number.isNaN(current)) return { $special: "NaN" }
                if (Object.is(current, -0)) return { $special: "-0" }
                if (current === Number.POSITIVE_INFINITY) {
                    return { $special: "+Infinity" }
                }
                if (current === Number.NEGATIVE_INFINITY) {
                    return { $special: "-Infinity" }
                }
            }
            return current
        },
        2,
    )

const programFailure = (
    program: CollectionProgram,
    index: number,
    error: unknown,
): Error =>
    new Error(
        `${program.name} failed at step ${index}\n` +
            `command prefix=${losslessJson(program.commands.slice(0, index + 1))}\n` +
            `mismatch=${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
    )

const runDifferential = (
    program: CollectionProgram,
): Readonly<{
    driver: CollectionRuntimeDriver
    executions: readonly RuntimeCommandExecution[]
}> => {
    const model = createReferenceModel()
    const driver = createCollectionRuntimeDriver()
    const subscriptions = new Map<string, SubscriptionSpec>()
    const snapshots: SnapshotPair[] = []
    const executions: RuntimeCommandExecution[] = []
    let modelTraceIndex = 0
    let modelAuditIndex = 0
    let rootScope: string | undefined
    let rowAuthority = new Set<string>()
    let membershipAuthority = new Set<string>()

    for (let index = 0; index < program.commands.length; index++) {
        const command = program.commands[index] as Command
        try {
            const modelResult = model.execute(command)
            const modelTrace = model.trace.slice(modelTraceIndex)
            const modelAudit = model.audit.slice(modelAuditIndex)
            modelTraceIndex = model.trace.length
            modelAuditIndex = model.audit.length

            const execution = driver.execute(command)
            executions.push(execution)
            expect(normalizeResult(execution.result)).toEqual(
                normalizeResult(modelResult),
            )
            compareTraceSlice(
                modelTrace,
                execution.trace,
                rootScope,
                subscriptions,
                snapshots,
            )
            const authority = compareStructuralInspection(
                modelAudit,
                execution,
                driver,
                rowAuthority,
                membershipAuthority,
            )
            const disposed = new Set(
                modelTrace.flatMap(event =>
                    event.kind === "disposed" ? [...event.scopes] : [],
                ),
            )
            rowAuthority = pruneDisposedAuthorities(authority.rows, disposed)
            membershipAuthority = pruneDisposedAuthorities(
                authority.memberships,
                disposed,
            )
            expect(execution.report.complete).toBe(true)
            expect(execution.report.fault).toBeUndefined()

            if (modelResult.ok && command.kind === "create-tree") {
                rootScope = command.root
            } else if (modelResult.ok && command.kind === "subscribe") {
                subscriptions.set(command.subscription, {
                    scope: command.scope,
                    target: command.target,
                })
            } else if (modelResult.ok && command.kind === "unsubscribe") {
                subscriptions.delete(command.subscription)
            }
        } catch (error) {
            throw programFailure(program, index, error)
        }
    }
    assertSnapshotEquivalence(snapshots)
    return Object.freeze({ driver, executions: Object.freeze(executions) })
}

describe("v1 collection model/public runtime differential", () => {
    for (const program of deterministicCollectionPrograms) {
        test(program.name, () => {
            const result = runDifferential(program)
            if (program.name === "V1M-COLLECTION-010") {
                const rootDeleteIndex = program.commands.findIndex(
                    command =>
                        command.kind === "mutate" &&
                        command.scope === "root" &&
                        command.mutation.kind === "delete-row",
                )
                const rootDelete = result.executions[rootDeleteIndex]!
                expect(
                    rootDelete.details.some(
                        detail => detail.type === "collection-effective-delta",
                    ),
                ).toBe(false)
            }
            if (program.name === "V1M-COLLECTION-013") {
                const reorderIndex = program.commands.findIndex(
                    command => command.kind === "transact",
                )
                const reorder = result.executions[reorderIndex]!
                expect(
                    reorder.details.filter(
                        detail => detail.type === "collection-effective-delta",
                    ),
                ).toEqual([])
                expect(
                    reorder.details.some(
                        detail =>
                            detail.type === "collection-source" &&
                            detail.source === "membership" &&
                            detail.action === "published",
                    ),
                ).toBe(true)
            }
            if (program.name === "V1M-COLLECTION-015") {
                const operations = result.driver
                    .report()
                    .summaries.filter(
                        (summary): summary is OperationInspection =>
                            summary.type === "operation",
                    )
                expect(operations.at(-1)?.effect).toBe("none")
            }
        })
    }

    const fixedSeeds = [0, 1, 0x5eedc0de, 0xffffffff] as const
    for (const seed of fixedSeeds) {
        test(`seeded-v1 ${seed}`, () => {
            runDifferential(generateCollectionProgram(seed, 128).program)
        })
    }
})
