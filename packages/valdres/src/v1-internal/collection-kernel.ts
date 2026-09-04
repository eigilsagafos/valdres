import type {
    AnyState,
    CollectionCommitPlan,
    CollectionCommitSource,
    CollectionMutationKind,
    ControlFaultSession,
    OptionalCollectionVTable,
    SynchronousResult,
} from "./committed-store-tree/runtime-domain"
import {
    WeakHandleSet,
    type OutcomeToken,
    type StoreScopeNode,
} from "./committed-store-tree/scope-node"
import { TreeDraft } from "./committed-store-tree/tree-transaction"

type CollectionHandle = object
type CollectionRowHandle = object

type InspectedThenable =
    | Readonly<{ kind: "not-thenable" }>
    | Readonly<{
          kind: "thenable"
          target: object | ((...args: never[]) => unknown)
          then: (...args: unknown[]) => unknown
      }>
    | Readonly<{ kind: "inspection-error"; error: unknown }>

export type CollectionDraftLocal =
    | Readonly<{ kind: "none" }>
    | Readonly<{ kind: "present"; value: unknown }>
    | Readonly<{ kind: "absent" }>

export type CollectionDraftOutcome =
    | Readonly<{ kind: "present"; value: unknown }>
    | Readonly<{ kind: "absent" }>

/** Captures local ownership separately from the effective read. `inherited`
 * is the outcome exposed by Reset. */
export interface CollectionDraftBaseline {
    readonly local: CollectionDraftLocal
    readonly effective: CollectionDraftOutcome
    readonly inherited: CollectionDraftOutcome
}

export interface CollectionKernelBindings {
    lookupRow(row: unknown): CollectionHandle | undefined
    lookupCollection(collection: unknown): boolean
    runGuarded<Result>(
        session: ControlFaultSession,
        operation: () => Result,
    ): Result
    inspectThenable(value: unknown): InspectedThenable
    containThenable(
        inspected: Extract<InspectedThenable, { kind: "thenable" }>,
    ): void
}

type CollectionBaselineReader = (
    scope: StoreScopeNode,
    row: CollectionRowHandle,
    collection: CollectionHandle,
) => CollectionDraftBaseline

type FinalRowIntent =
    | Readonly<{ kind: "present"; value: unknown }>
    | Readonly<{ kind: "absent" }>
    | Readonly<{ kind: "reset" }>

type PresenceEventKind = FinalRowIntent["kind"]

type CommittedRowLocal = Exclude<CollectionDraftLocal, { kind: "none" }>

interface RowViewRecord {
    readonly scope: StoreScopeNode
    readonly atom: CollectionRowHandle
    served: Readonly<{ token: OutcomeToken; outcome: SynchronousResult }>
    inheritedFrom: RowViewRecord | undefined
    readonly inheritingChildren: WeakHandleSet<RowViewRecord>
}

interface MembershipRecord {
    readonly scope: StoreScopeNode
    readonly atom: CollectionHandle
    served: Readonly<{ token: OutcomeToken; outcome: SynchronousResult }>
    inheritedFrom: MembershipRecord | undefined
    readonly inheritingChildren: WeakHandleSet<MembershipRecord>
}

interface CollectionScopeSidecar {
    rowLocals: WeakMap<CollectionRowHandle, CommittedRowLocal> | undefined
    ownedRows: Set<CollectionRowHandle> | undefined
    rowViews: WeakMap<CollectionRowHandle, RowViewRecord> | undefined
    liveRowViews: WeakHandleSet<RowViewRecord> | undefined
    memberships: WeakMap<CollectionHandle, MembershipRecord> | undefined
    liveMemberships: WeakHandleSet<MembershipRecord> | undefined
}

interface RowApplyPlan {
    readonly coordinate: DraftCoordinate
    readonly local: CollectionDraftLocal
    readonly ownershipChanged: boolean
}

interface RowSettlementPlan extends CollectionCommitSource {
    readonly record: RowViewRecord
    readonly outcome: CollectionDraftOutcome
}

interface MembershipPlanNode {
    readonly scope: StoreScopeNode
    readonly atom: CollectionHandle
    readonly existing: MembershipRecord | undefined
    readonly parent: MembershipPlanNode | undefined
    readonly beforeRows: readonly CollectionRowHandle[]
    readonly plannedChildren: MembershipPlanNode[]
    finalRows: readonly CollectionRowHandle[] | undefined
    installed: MembershipRecord | undefined
    affected: boolean
    containsAffected: boolean
}

interface MembershipSettlementPlan extends CollectionCommitSource {
    readonly node: MembershipPlanNode
    readonly record: MembershipRecord
    readonly rows: readonly CollectionRowHandle[]
}

interface ScopedCollectionCommitPlan extends CollectionCommitPlan {
    readonly rows: readonly RowApplyPlan[]
    readonly rowSettlements: readonly RowSettlementPlan[]
    readonly membershipInstalls: readonly MembershipPlanNode[]
    readonly membershipSettlements: readonly MembershipSettlementPlan[]
    readonly sources: readonly CollectionCommitSource[]
}

interface PresenceEvent {
    readonly coordinateId: number
    readonly scope: StoreScopeNode
    readonly row: CollectionRowHandle
    readonly collection: CollectionHandle
    readonly kind: PresenceEventKind
    readonly sequence: number
}

const BASELINE_BIRTH = Symbol("collection baseline birth")
type EnablingBirth = number | typeof BASELINE_BIRTH

interface DraftCoordinate {
    readonly scope: StoreScopeNode
    readonly row: CollectionRowHandle
    readonly collection: CollectionHandle
    readonly baseline: CollectionDraftBaseline
    readonly discoveryIndex: number
    planIndex: number | undefined
    final: FinalRowIntent | undefined
    enablingBirth: EnablingBirth | undefined
}

interface MembershipMemo {
    readonly revision: number
    readonly rows: readonly CollectionRowHandle[]
}

interface DraftRowLane {
    readonly coordinatesByAncestor: Map<StoreScopeNode, DraftCoordinate[]>
    readonly historyByScope: Map<StoreScopeNode, PresenceEvent[]>
}

interface DraftLane {
    readonly byScope: Map<
        StoreScopeNode,
        Map<CollectionRowHandle, DraftCoordinate>
    >
    readonly planOrder: DraftCoordinate[]
    readonly history: PresenceEvent[]
    readonly historyByCollectionScope: Map<
        CollectionHandle,
        Map<StoreScopeNode, PresenceEvent[]>
    >
    readonly byRow: Map<CollectionRowHandle, DraftRowLane>
    readonly revisionByCollection: Map<CollectionHandle, number>
    readonly membershipMemo: Map<
        StoreScopeNode,
        Map<CollectionHandle, MembershipMemo>
    >
    nextDiscoveryIndex: number
}

export interface CollectionDraftInspection {
    readonly discoveryOrder: readonly Readonly<{
        id: number
        baselineLocal: CollectionDraftLocal["kind"]
        baselineEffective: CollectionDraftOutcome["kind"]
        baselineInherited: CollectionDraftOutcome["kind"]
        final: FinalRowIntent["kind"] | undefined
        enablingBirth: number | "baseline" | undefined
    }>[]
    readonly planOrder: readonly Readonly<{
        id: number
        baselineLocal: CollectionDraftLocal["kind"]
        baselineEffective: CollectionDraftOutcome["kind"]
        baselineInherited: CollectionDraftOutcome["kind"]
        final: FinalRowIntent["kind"] | undefined
        enablingBirth: number | "baseline" | undefined
    }>[]
    readonly history: readonly Readonly<{
        coordinateId: number
        kind: PresenceEventKind
        sequence: number
    }>[]
    readonly membershipMemoCount: number
    revision(collection: CollectionHandle): number
}

export interface CollectionDraftKernel extends OptionalCollectionVTable {
    stageSet(
        draft: TreeDraft,
        scope: StoreScopeNode,
        row: CollectionRowHandle,
        value: unknown,
        session: ControlFaultSession,
    ): void
    stageUpdate(
        draft: TreeDraft,
        scope: StoreScopeNode,
        row: CollectionRowHandle,
        update: unknown,
        session: ControlFaultSession,
    ): void
    stageDelete(
        draft: TreeDraft,
        scope: StoreScopeNode,
        row: CollectionRowHandle,
    ): void
    stageReset(
        draft: TreeDraft,
        scope: StoreScopeNode,
        row: CollectionRowHandle,
    ): void
    readDraftRow(
        draft: TreeDraft,
        scope: StoreScopeNode,
        row: CollectionRowHandle,
    ): unknown
    readDraftCollection(
        draft: TreeDraft,
        scope: StoreScopeNode,
        collection: CollectionHandle,
    ): readonly CollectionRowHandle[]
    beginMembershipRebuildTraceForTest(): () => readonly object[]
    beginMembershipPlacementTraceForTest(): () => Readonly<{
        coordinates: number
        states: number
    }>
    hasDraftLane(draft: TreeDraft): boolean
    inspectDraft(draft: TreeDraft): CollectionDraftInspection | undefined
}

abstract class ImmutableCollectionError extends Error {
    abstract readonly code: string

    protected seal(): void {
        Object.freeze(this)
    }
}

export class InvalidSynchronousCollectionValueError extends ImmutableCollectionError {
    readonly code = "VALDRES_INVALID_SYNCHRONOUS_COLLECTION_VALUE"

    constructor() {
        super("Collection row values must be synchronous")
        this.name = "InvalidSynchronousCollectionValueError"
        this.seal()
    }
}

export class UndefinedCollectionValueError extends ImmutableCollectionError {
    readonly code = "VALDRES_UNDEFINED_COLLECTION_VALUE"

    constructor() {
        super("Collection row values cannot be undefined")
        this.name = "UndefinedCollectionValueError"
        this.seal()
    }
}

export class MissingCollectionRowError extends ImmutableCollectionError {
    readonly code = "VALDRES_MISSING_COLLECTION_ROW"

    constructor() {
        super("Cannot update an absent collection row")
        this.name = "MissingCollectionRowError"
        this.seal()
    }
}

const NONE: CollectionDraftLocal = Object.freeze({ kind: "none" })
const ABSENT_LOCAL: CollectionDraftLocal = Object.freeze({ kind: "absent" })
const ABSENT: CollectionDraftOutcome = Object.freeze({ kind: "absent" })
const EMPTY_ROWS = Object.freeze([]) as readonly CollectionRowHandle[]
const presentLocal = (value: unknown): CollectionDraftLocal =>
    Object.freeze({ kind: "present", value })

const presentOutcome = (value: unknown): CollectionDraftOutcome =>
    Object.freeze({ kind: "present", value })

const sameOutcome = (
    first: CollectionDraftOutcome,
    second: CollectionDraftOutcome,
): boolean =>
    first.kind === second.kind &&
    (first.kind === "absent" ||
        (second.kind === "present" && Object.is(first.value, second.value)))

const sameLocal = (
    first: CollectionDraftLocal,
    second: CollectionDraftLocal,
): boolean =>
    first.kind === second.kind &&
    (first.kind !== "present" ||
        (second.kind === "present" && Object.is(first.value, second.value)))

const freezeBaseline = (
    baseline: CollectionDraftBaseline,
): CollectionDraftBaseline => {
    const local =
        baseline.local.kind === "present"
            ? presentLocal(baseline.local.value)
            : baseline.local.kind === "absent"
              ? ABSENT_LOCAL
              : NONE
    const effective =
        baseline.effective.kind === "present"
            ? presentOutcome(baseline.effective.value)
            : ABSENT
    const inherited =
        baseline.inherited.kind === "present"
            ? presentOutcome(baseline.inherited.value)
            : ABSENT
    if (local.kind === "none" && !sameOutcome(effective, inherited)) {
        throw new Error(
            "Collection baseline without local ownership must equal inherited outcome",
        )
    }
    if (
        local.kind === "present" &&
        (effective.kind !== "present" ||
            !Object.is(local.value, effective.value))
    ) {
        throw new Error(
            "Collection present local baseline must equal its effective outcome",
        )
    }
    if (local.kind === "absent" && effective.kind !== "absent") {
        throw new Error(
            "Collection absent local baseline must be effectively absent",
        )
    }
    return Object.freeze({ local, effective, inherited })
}

const currentLocal = (coordinate: DraftCoordinate): CollectionDraftLocal => {
    const final = coordinate.final
    if (final === undefined) return coordinate.baseline.local
    if (final.kind === "present") return presentLocal(final.value)
    return final.kind === "absent" ? ABSENT_LOCAL : NONE
}

const outcomeForLocal = (
    local: CollectionDraftLocal,
    inherited: CollectionDraftOutcome,
): CollectionDraftOutcome =>
    local.kind === "present"
        ? presentOutcome(local.value)
        : local.kind === "absent"
          ? ABSENT
          : inherited

const servedOutcome = (outcome: CollectionDraftOutcome): SynchronousResult =>
    Object.freeze({
        kind: "value",
        value: outcome.kind === "present" ? outcome.value : undefined,
    })

const sameRows = (
    first: readonly CollectionRowHandle[],
    second: readonly CollectionRowHandle[],
): boolean => {
    if (first.length !== second.length) return false
    for (let index = 0; index < first.length; index++) {
        if (!Object.is(first[index], second[index])) return false
    }
    return true
}

/** @internal Tree-shakeable draft and committed-membership engine. The
 * optional baseline reader exists only for deterministic draft tests. */
export const createCollectionKernel = (
    bindings: CollectionKernelBindings,
    readBaselineOverride?: CollectionBaselineReader,
): CollectionDraftKernel => {
    const lanes = new WeakMap<TreeDraft, DraftLane>()
    const scopeSidecars = new WeakMap<StoreScopeNode, CollectionScopeSidecar>()
    let membershipRebuildTraceForTest: object[] | undefined
    let membershipPlacementTraceForTest:
        | { coordinates: number; states: number }
        | undefined

    const sidecarFor = (scope: StoreScopeNode): CollectionScopeSidecar => {
        let sidecar = scopeSidecars.get(scope)
        if (sidecar !== undefined) return sidecar
        sidecar = {
            rowLocals: undefined,
            ownedRows: undefined,
            rowViews: undefined,
            liveRowViews: undefined,
            memberships: undefined,
            liveMemberships: undefined,
        }
        scopeSidecars.set(scope, sidecar)
        return sidecar
    }

    const committedLocal = (
        scope: StoreScopeNode,
        row: CollectionRowHandle,
    ): CollectionDraftLocal =>
        scopeSidecars.get(scope)?.rowLocals?.get(row) ?? NONE

    const committedOutcome = (
        scope: StoreScopeNode | undefined,
        row: CollectionRowHandle,
    ): CollectionDraftOutcome => {
        let current = scope
        while (current !== undefined) {
            const local = committedLocal(current, row)
            if (local.kind === "present") return presentOutcome(local.value)
            if (local.kind === "absent") return ABSENT
            current = current.parent
        }
        return ABSENT
    }

    const readCommittedBaseline: CollectionBaselineReader = (scope, row) => {
        const local = committedLocal(scope, row)
        const inherited = committedOutcome(scope.parent, row)
        return Object.freeze({
            local,
            effective: outcomeForLocal(local, inherited),
            inherited,
        })
    }
    const readBaseline = readBaselineOverride ?? readCommittedBaseline

    const draftLocal = (
        lane: DraftLane,
        scope: StoreScopeNode,
        row: CollectionRowHandle,
        collection: CollectionHandle,
    ): CollectionDraftLocal => {
        const coordinate = lane.byScope.get(scope)?.get(row)
        if (coordinate !== undefined) return currentLocal(coordinate)
        return freezeBaseline(readBaseline(scope, row, collection)).local
    }

    const draftOutcome = (
        lane: DraftLane,
        scope: StoreScopeNode | undefined,
        row: CollectionRowHandle,
        collection: CollectionHandle,
    ): CollectionDraftOutcome => {
        let current = scope
        while (current !== undefined) {
            const local = draftLocal(lane, current, row, collection)
            if (local.kind === "present") return presentOutcome(local.value)
            if (local.kind === "absent") return ABSENT
            if (readBaselineOverride !== undefined) {
                const coordinate = lane.byScope.get(current)?.get(row)
                if (coordinate !== undefined) {
                    return coordinate.baseline.inherited
                }
                return freezeBaseline(readBaseline(current, row, collection))
                    .inherited
            }
            current = current.parent
        }
        return ABSENT
    }

    const replayEnablingBirth = (
        lane: DraftLane,
        scope: StoreScopeNode,
        row: CollectionRowHandle,
        collection: CollectionHandle,
    ): EnablingBirth | undefined => {
        if (readBaselineOverride !== undefined) {
            const baseline = freezeBaseline(
                readBaseline(scope, row, collection),
            )
            let present = baseline.effective.kind === "present"
            let birth: EnablingBirth | undefined = present
                ? BASELINE_BIRTH
                : undefined
            for (const event of lane.byRow
                .get(row)
                ?.historyByScope.get(scope) ?? []) {
                if (
                    !Object.is(event.row, row) ||
                    !Object.is(event.scope, scope)
                ) {
                    continue
                }
                const nextPresent =
                    event.kind === "present" ||
                    (event.kind === "reset" &&
                        baseline.inherited.kind === "present")
                if (!present && nextPresent) birth = event.sequence
                else if (!nextPresent) birth = undefined
                present = nextPresent
            }
            return birth
        }

        const route: StoreScopeNode[] = []
        const local = new Map<StoreScopeNode, CollectionDraftLocal["kind"]>()
        let current: StoreScopeNode | undefined = scope
        while (current !== undefined) {
            route.push(current)
            local.set(
                current,
                freezeBaseline(readBaseline(current, row, collection)).local
                    .kind,
            )
            current = current.parent
        }
        const events: PresenceEvent[] = []
        const rowLane = lane.byRow.get(row)
        if (rowLane !== undefined) {
            for (const routeScope of route) {
                const scopeHistory = rowLane.historyByScope.get(routeScope)
                if (scopeHistory !== undefined) events.push(...scopeHistory)
            }
            events.sort((first, second) => first.sequence - second.sequence)
        }
        const isPresent = (): boolean => {
            for (const routeScope of route) {
                const kind = local.get(routeScope)
                if (kind === "present") return true
                if (kind === "absent") return false
            }
            return false
        }
        let present = isPresent()
        let birth: EnablingBirth | undefined = present
            ? BASELINE_BIRTH
            : undefined
        for (const event of events) {
            local.set(
                event.scope,
                event.kind === "present"
                    ? "present"
                    : event.kind === "absent"
                      ? "absent"
                      : "none",
            )
            const nextPresent = isPresent()
            if (!present && nextPresent) birth = event.sequence
            else if (!nextPresent) birth = undefined
            present = nextPresent
        }
        return birth
    }

    const createRowView = (
        scope: StoreScopeNode,
        row: CollectionRowHandle,
        outcome: CollectionDraftOutcome,
        inheritedFrom?: RowViewRecord,
    ): RowViewRecord => {
        const sidecar = sidecarFor(scope)
        const existing = sidecar.rowViews?.get(row)
        if (existing !== undefined) return existing
        const record: RowViewRecord = {
            scope,
            atom: row,
            served: Object.freeze({
                token: scope.createOutcomeToken(),
                outcome: servedOutcome(outcome),
            }),
            inheritedFrom,
            inheritingChildren: new WeakHandleSet(() =>
                scope.coordinator.recordCounter("deadRouteCompactions"),
            ),
        }
        let rowViews = sidecar.rowViews
        if (rowViews === undefined) {
            rowViews = new WeakMap()
            sidecar.rowViews = rowViews
        }
        let liveRowViews = sidecar.liveRowViews
        if (liveRowViews === undefined) {
            liveRowViews = new WeakHandleSet(() =>
                scope.coordinator.recordCounter("deadRouteCompactions"),
            )
            sidecar.liveRowViews = liveRowViews
        }
        rowViews.set(row, record)
        liveRowViews.add(record)
        if (inheritedFrom !== undefined) {
            inheritedFrom.inheritingChildren.add(record)
            scope.coordinator.recordCounter("routeAdds")
        }
        return record
    }

    const materializeRowView = (
        scope: StoreScopeNode,
        row: CollectionRowHandle,
    ): RowViewRecord => {
        let currentScope = scope
        const unresolved: StoreScopeNode[] = []
        let current: RowViewRecord
        while (true) {
            const sidecar = scopeSidecars.get(currentScope)
            const materialized = sidecar?.rowViews?.get(row)
            if (materialized !== undefined) {
                current = materialized
                break
            }
            const local = sidecar?.rowLocals?.get(row)
            if (local !== undefined) {
                current = createRowView(
                    currentScope,
                    row,
                    local.kind === "present"
                        ? presentOutcome(local.value)
                        : ABSENT,
                )
                break
            }
            if (currentScope.parent === undefined) {
                current = createRowView(currentScope, row, ABSENT)
                break
            }
            unresolved.push(currentScope)
            currentScope = currentScope.parent
        }
        for (let index = unresolved.length - 1; index >= 0; index--) {
            current = createRowView(
                unresolved[index] as StoreScopeNode,
                row,
                current.served.outcome.kind === "value" &&
                    current.served.outcome.value !== undefined
                    ? presentOutcome(current.served.outcome.value)
                    : ABSENT,
                current,
            )
        }
        return current
    }

    const detachRowView = (record: RowViewRecord): void => {
        const inheritedFrom = record.inheritedFrom
        if (inheritedFrom === undefined) return
        inheritedFrom.inheritingChildren.delete(record)
        record.inheritedFrom = undefined
        record.scope.coordinator.recordCounter("routeRemoves")
    }

    const attachRowView = (
        record: RowViewRecord,
        inheritedFrom: RowViewRecord,
    ): void => {
        if (Object.is(record.inheritedFrom, inheritedFrom)) return
        detachRowView(record)
        record.inheritedFrom = inheritedFrom
        inheritedFrom.inheritingChildren.add(record)
        record.scope.coordinator.recordCounter("routeAdds")
    }

    const membershipRows = (
        record: MembershipRecord,
    ): readonly CollectionRowHandle[] =>
        record.served.outcome.kind === "value"
            ? (record.served.outcome.value as readonly CollectionRowHandle[])
            : EMPTY_ROWS

    const registerMembershipRecord = (
        scope: StoreScopeNode,
        collection: CollectionHandle,
        rows: readonly CollectionRowHandle[],
    ): MembershipRecord => {
        const sidecar = sidecarFor(scope)
        const current = sidecar.memberships?.get(collection)
        if (current !== undefined) return current
        const record: MembershipRecord = {
            scope,
            atom: collection,
            served: Object.freeze({
                token: scope.createOutcomeToken(),
                outcome: Object.freeze({ kind: "value", value: rows }),
            }),
            inheritedFrom: undefined,
            inheritingChildren: new WeakHandleSet(() =>
                scope.coordinator.recordCounter("deadRouteCompactions"),
            ),
        }
        let memberships = sidecar.memberships
        if (memberships === undefined) {
            memberships = new WeakMap()
            sidecar.memberships = memberships
        }
        let liveMemberships = sidecar.liveMemberships
        if (liveMemberships === undefined) {
            liveMemberships = new WeakHandleSet(() =>
                scope.coordinator.recordCounter("deadRouteCompactions"),
            )
            sidecar.liveMemberships = liveMemberships
        }
        memberships.set(collection, record)
        liveMemberships.add(record)
        return record
    }

    const detachMembership = (record: MembershipRecord): void => {
        const inheritedFrom = record.inheritedFrom
        if (inheritedFrom === undefined) return
        inheritedFrom.inheritingChildren.delete(record)
        record.inheritedFrom = undefined
        record.scope.coordinator.recordCounter("routeRemoves")
    }

    const attachMembership = (
        record: MembershipRecord,
        inheritedFrom: MembershipRecord,
    ): void => {
        if (Object.is(record.inheritedFrom, inheritedFrom)) return
        detachMembership(record)
        record.inheritedFrom = inheritedFrom
        inheritedFrom.inheritingChildren.add(record)
        record.scope.coordinator.recordCounter("routeAdds")
    }

    const materializeMembership = (
        scope: StoreScopeNode,
        collection: CollectionHandle,
    ): MembershipRecord => {
        let currentScope = scope
        const unresolved: StoreScopeNode[] = []
        let current: MembershipRecord
        while (true) {
            const materialized = scopeSidecars
                .get(currentScope)
                ?.memberships?.get(collection)
            if (materialized !== undefined) {
                current = materialized
                break
            }
            if (currentScope.parent === undefined) {
                current = registerMembershipRecord(
                    currentScope,
                    collection,
                    Object.freeze([]),
                )
                break
            }
            unresolved.push(currentScope)
            currentScope = currentScope.parent
        }
        for (let index = unresolved.length - 1; index >= 0; index--) {
            const child = registerMembershipRecord(
                unresolved[index] as StoreScopeNode,
                collection,
                Object.freeze([...membershipRows(current)]),
            )
            attachMembership(child, current)
            current = child
        }
        return current
    }

    const releaseDraft = (draftValue: object): void => {
        const draft = draftValue as TreeDraft
        const lane = lanes.get(draft)
        if (lane === undefined) return
        lanes.delete(draft)
        for (const coordinates of lane.byScope.values()) {
            for (const coordinate of coordinates.values()) {
                coordinate.final = undefined
            }
            coordinates.clear()
        }
        lane.byScope.clear()
        lane.planOrder.length = 0
        lane.history.length = 0
        for (const byScope of lane.historyByCollectionScope.values()) {
            for (const history of byScope.values()) history.length = 0
            byScope.clear()
        }
        lane.historyByCollectionScope.clear()
        for (const rowLane of lane.byRow.values()) {
            for (const coordinates of rowLane.coordinatesByAncestor.values()) {
                coordinates.length = 0
            }
            rowLane.coordinatesByAncestor.clear()
            for (const history of rowLane.historyByScope.values()) {
                history.length = 0
            }
            rowLane.historyByScope.clear()
        }
        lane.byRow.clear()
        lane.revisionByCollection.clear()
        for (const byCollection of lane.membershipMemo.values()) {
            byCollection.clear()
        }
        lane.membershipMemo.clear()
    }

    const laneFor = (draft: TreeDraft): DraftLane => {
        let lane = lanes.get(draft)
        if (lane !== undefined) return lane
        lane = {
            byScope: new Map(),
            planOrder: [],
            history: [],
            historyByCollectionScope: new Map(),
            byRow: new Map(),
            revisionByCollection: new Map(),
            membershipMemo: new Map(),
            nextDiscoveryIndex: 0,
        }
        draft.installRows(releaseDraft)
        lanes.set(draft, lane)
        return lane
    }

    const collectionForRow = (row: unknown): CollectionHandle => {
        const collection = bindings.lookupRow(row)
        if (collection === undefined) {
            throw new TypeError(
                "Collection draft operation requires a valid row",
            )
        }
        return collection
    }

    const advanceMembershipRevision = (
        lane: DraftLane,
        collection: CollectionHandle,
    ): void => {
        lane.revisionByCollection.set(
            collection,
            (lane.revisionByCollection.get(collection) ?? 0) + 1,
        )
    }

    const coordinateFor = (
        draft: TreeDraft,
        scope: StoreScopeNode,
        row: CollectionRowHandle,
        collection = collectionForRow(row),
    ): DraftCoordinate => {
        const lane = laneFor(draft)
        let coordinates = lane.byScope.get(scope)
        if (coordinates === undefined) {
            coordinates = new Map()
            lane.byScope.set(scope, coordinates)
        }
        let coordinate = coordinates.get(row)
        if (coordinate !== undefined) return coordinate
        if (membershipPlacementTraceForTest !== undefined) {
            membershipPlacementTraceForTest.coordinates++
        }
        const committed = freezeBaseline(readBaseline(scope, row, collection))
        const inherited =
            readBaselineOverride === undefined
                ? draftOutcome(lane, scope.parent, row, collection)
                : committed.inherited
        const baseline = freezeBaseline({
            local: committed.local,
            effective: outcomeForLocal(committed.local, inherited),
            inherited,
        })
        coordinate = {
            scope,
            row,
            collection,
            baseline,
            discoveryIndex: lane.nextDiscoveryIndex++,
            planIndex: undefined,
            final: undefined,
            enablingBirth: undefined,
        }
        coordinates.set(row, coordinate)
        let rowLane = lane.byRow.get(row)
        if (rowLane === undefined) {
            rowLane = {
                coordinatesByAncestor: new Map(),
                historyByScope: new Map(),
            }
            lane.byRow.set(row, rowLane)
        }
        let ancestor: StoreScopeNode | undefined = scope
        while (ancestor !== undefined) {
            let descendants = rowLane.coordinatesByAncestor.get(ancestor)
            if (descendants === undefined) {
                descendants = []
                rowLane.coordinatesByAncestor.set(ancestor, descendants)
            }
            descendants.push(coordinate)
            ancestor = ancestor.parent
        }
        coordinate.enablingBirth = replayEnablingBirth(
            lane,
            scope,
            row,
            collection,
        )
        return coordinate
    }

    const installEvent = (
        draft: TreeDraft,
        coordinate: DraftCoordinate,
        final: FinalRowIntent,
        local: CollectionDraftLocal,
        effective: CollectionDraftOutcome,
    ): void => {
        const beforeLocal = currentLocal(coordinate)
        const lane = laneFor(draft)
        const beforeEffective = draftOutcome(
            lane,
            coordinate.scope,
            coordinate.row,
            coordinate.collection,
        )
        if (
            sameLocal(beforeLocal, local) &&
            sameOutcome(beforeEffective, effective)
        ) {
            return
        }
        const affectedCoordinates: {
            coordinate: DraftCoordinate
            effective: CollectionDraftOutcome
            placement: EnablingBirth | undefined
        }[] = []
        for (const candidate of lane.byRow
            .get(coordinate.row)!
            .coordinatesByAncestor.get(coordinate.scope) ?? []) {
            const candidateEffective = draftOutcome(
                lane,
                candidate.scope,
                candidate.row,
                candidate.collection,
            )
            affectedCoordinates.push({
                coordinate: candidate,
                effective: candidateEffective,
                placement:
                    candidateEffective.kind === "present"
                        ? candidate.enablingBirth
                        : undefined,
            })
        }

        const sequence = draft.generation
        if (coordinate.planIndex === undefined) {
            coordinate.planIndex = lane.planOrder.length
            lane.planOrder.push(coordinate)
        }
        coordinate.final = final
        const event = Object.freeze({
            coordinateId: coordinate.discoveryIndex,
            scope: coordinate.scope,
            row: coordinate.row,
            collection: coordinate.collection,
            kind: final.kind,
            sequence,
        })
        lane.history.push(event)
        const rowLane = lane.byRow.get(coordinate.row)!
        let scopeHistory = rowLane.historyByScope.get(coordinate.scope)
        if (scopeHistory === undefined) {
            scopeHistory = []
            rowLane.historyByScope.set(coordinate.scope, scopeHistory)
        }
        scopeHistory.push(event)
        let byCollection = lane.historyByCollectionScope.get(
            coordinate.collection,
        )
        if (byCollection === undefined) {
            byCollection = new Map()
            lane.historyByCollectionScope.set(
                coordinate.collection,
                byCollection,
            )
        }
        let collectionScopeHistory = byCollection.get(coordinate.scope)
        if (collectionScopeHistory === undefined) {
            collectionScopeHistory = []
            byCollection.set(coordinate.scope, collectionScopeHistory)
        }
        collectionScopeHistory.push(event)
        let placementChanged = false
        for (const before of affectedCoordinates) {
            const candidate = before.coordinate
            const after = draftOutcome(
                lane,
                candidate.scope,
                candidate.row,
                candidate.collection,
            )
            if (
                before.effective.kind === "absent" &&
                after.kind === "present"
            ) {
                candidate.enablingBirth = sequence
            } else if (after.kind === "absent") {
                candidate.enablingBirth = undefined
            }
            const placement =
                after.kind === "present"
                    ? candidate.enablingBirth
                    : undefined
            if (!Object.is(before.placement, placement)) {
                placementChanged = true
            }
        }
        if (placementChanged) {
            advanceMembershipRevision(lane, coordinate.collection)
        }
        draft.markRow(sequence)
    }

    const invalidSynchronousValue =
        (): InvalidSynchronousCollectionValueError =>
            new InvalidSynchronousCollectionValueError()

    const validateValue = (value: unknown): unknown => {
        const inspected = bindings.inspectThenable(value)
        if (inspected.kind === "inspection-error") throw inspected.error
        if (inspected.kind === "thenable") {
            bindings.containThenable(inspected)
            throw invalidSynchronousValue()
        }
        if (value === undefined) throw new UndefinedCollectionValueError()
        return value
    }

    const runUpdater = (
        update: (current: unknown) => unknown,
        current: unknown,
        session: ControlFaultSession,
    ): unknown =>
        bindings.runGuarded(session, () => {
            let candidate: unknown
            try {
                candidate = Reflect.apply(update, undefined, [current])
            } catch (thrown) {
                const inspected = bindings.inspectThenable(thrown)
                if (inspected.kind === "not-thenable") throw thrown
                if (inspected.kind === "inspection-error") {
                    throw inspected.error
                }
                bindings.containThenable(inspected)
                throw invalidSynchronousValue()
            }
            return validateValue(candidate)
        })

    const stageSet: CollectionDraftKernel["stageSet"] = (
        draft,
        scope,
        row,
        value,
        session,
    ) => {
        const collection = collectionForRow(row)
        const admitted = bindings.runGuarded(session, () =>
            validateValue(value),
        )
        const coordinate = coordinateFor(draft, scope, row, collection)
        installEvent(
            draft,
            coordinate,
            Object.freeze({ kind: "present", value: admitted }),
            presentLocal(admitted),
            presentOutcome(admitted),
        )
    }

    const stageUpdate: CollectionDraftKernel["stageUpdate"] = (
        draft,
        scope,
        row,
        update,
        session,
    ) => {
        const collection = collectionForRow(row)
        if (typeof update !== "function") {
            throw new TypeError("Collection row update requires an updater")
        }
        const coordinate = coordinateFor(draft, scope, row, collection)
        const current = draftOutcome(laneFor(draft), scope, row, collection)
        if (current.kind === "absent") throw new MissingCollectionRowError()
        const admitted = runUpdater(
            update as (current: unknown) => unknown,
            current.value,
            session,
        )
        installEvent(
            draft,
            coordinate,
            Object.freeze({ kind: "present", value: admitted }),
            presentLocal(admitted),
            presentOutcome(admitted),
        )
    }

    const stageDelete: CollectionDraftKernel["stageDelete"] = (
        draft,
        scope,
        row,
    ) => {
        const coordinate = coordinateFor(draft, scope, row)
        installEvent(
            draft,
            coordinate,
            Object.freeze({ kind: "absent" }),
            ABSENT_LOCAL,
            ABSENT,
        )
    }

    const stageReset: CollectionDraftKernel["stageReset"] = (
        draft,
        scope,
        row,
    ) => {
        const coordinate = coordinateFor(draft, scope, row)
        const inherited =
            readBaselineOverride === undefined
                ? draftOutcome(
                      laneFor(draft),
                      scope.parent,
                      row,
                      coordinate.collection,
                  )
                : coordinate.baseline.inherited
        installEvent(
            draft,
            coordinate,
            Object.freeze({ kind: "reset" }),
            NONE,
            inherited,
        )
    }

    const readDraftRow: CollectionDraftKernel["readDraftRow"] = (
        draft,
        scope,
        row,
    ) => {
        const coordinate = coordinateFor(draft, scope, row)
        const outcome = draftOutcome(
            laneFor(draft),
            scope,
            row,
            coordinate.collection,
        )
        return outcome.kind === "present" ? outcome.value : undefined
    }

    const readDraftCollection: CollectionDraftKernel["readDraftCollection"] = (
        draft,
        scope,
        collection,
    ) => {
        if (!bindings.lookupCollection(collection)) {
            throw new TypeError(
                "Collection draft read requires a valid collection",
            )
        }
        const lane = laneFor(draft)
        const revision = lane.revisionByCollection.get(collection) ?? 0
        let byCollection = lane.membershipMemo.get(scope)
        const current = byCollection?.get(collection)
        if (current?.revision === revision) return current.rows

        const baseline =
            readBaselineOverride === undefined &&
            typeof scope.createOutcomeToken === "function"
                ? membershipRows(materializeMembership(scope, collection))
                : EMPTY_ROWS
        const candidates = new Map<CollectionRowHandle, DraftCoordinate>()
        const history = lane.historyByCollectionScope.get(collection)
        let routeScope: StoreScopeNode | undefined = scope
        while (routeScope !== undefined) {
            for (const event of history?.get(routeScope) ?? []) {
                if (!candidates.has(event.row)) {
                    candidates.set(
                        event.row,
                        coordinateFor(draft, scope, event.row, collection),
                    )
                }
            }
            routeScope = routeScope.parent
        }
        const rows: CollectionRowHandle[] = []
        for (const row of baseline) {
            const coordinate = candidates.get(row)
            if (
                coordinate === undefined ||
                coordinate.enablingBirth === BASELINE_BIRTH
            ) {
                rows.push(row)
            }
        }
        const births: DraftCoordinate[] = []
        for (const coordinate of candidates.values()) {
            if (
                typeof coordinate.enablingBirth === "number" &&
                draftOutcome(
                    lane,
                    coordinate.scope,
                    coordinate.row,
                    coordinate.collection,
                ).kind === "present"
            ) {
                births.push(coordinate)
            }
        }
        births.sort((first, second) => {
            const firstBirth = first.enablingBirth
            const secondBirth = second.enablingBirth
            if (firstBirth === secondBirth) {
                return first.discoveryIndex - second.discoveryIndex
            }
            return (firstBirth as number) - (secondBirth as number)
        })
        for (const coordinate of births) rows.push(coordinate.row)
        const snapshot = sameRows(baseline, rows)
            ? baseline
            : current !== undefined && sameRows(current.rows, rows)
              ? current.rows
              : Object.freeze(rows)
        if (byCollection === undefined) {
            byCollection = new Map()
            lane.membershipMemo.set(scope, byCollection)
        }
        byCollection.set(
            collection,
            Object.freeze({ revision, rows: snapshot }),
        )
        return snapshot
    }

    const inspectDraft: CollectionDraftKernel["inspectDraft"] = draft => {
        const lane = lanes.get(draft)
        if (lane === undefined) return undefined
        let membershipMemoCount = 0
        for (const byCollection of lane.membershipMemo.values()) {
            membershipMemoCount += byCollection.size
        }
        const revisionSnapshot = new WeakMap<
            CollectionHandle,
            Readonly<{ value: number }>
        >()
        for (const [collection, revision] of lane.revisionByCollection) {
            revisionSnapshot.set(collection, Object.freeze({ value: revision }))
        }
        const inspectCoordinate = (coordinate: DraftCoordinate) =>
            Object.freeze({
                id: coordinate.discoveryIndex,
                baselineLocal: coordinate.baseline.local.kind,
                baselineEffective: coordinate.baseline.effective.kind,
                baselineInherited: coordinate.baseline.inherited.kind,
                final: coordinate.final?.kind,
                enablingBirth:
                    coordinate.enablingBirth === BASELINE_BIRTH
                        ? ("baseline" as const)
                        : coordinate.enablingBirth,
            })
        return Object.freeze({
            discoveryOrder: Object.freeze(
                [...lane.byScope.values()]
                    .flatMap(coordinates => [...coordinates.values()])
                    .sort(
                        (first, second) =>
                            first.discoveryIndex - second.discoveryIndex,
                    )
                    .map(inspectCoordinate),
            ),
            planOrder: Object.freeze(lane.planOrder.map(inspectCoordinate)),
            history: Object.freeze(
                lane.history.map(event =>
                    Object.freeze({
                        coordinateId: event.coordinateId,
                        kind: event.kind,
                        sequence: event.sequence,
                    }),
                ),
            ),
            membershipMemoCount,
            revision: (collection: CollectionHandle): number =>
                revisionSnapshot.get(collection)?.value ?? 0,
        })
    }

    const planCommit = (
        draftValue: object,
    ): CollectionCommitPlan | undefined => {
        const draft = draftValue as TreeDraft
        if (!draft.hasRows) return undefined
        const lane = lanes.get(draft)
        if (lane === undefined) {
            throw new Error("Collection row draft lane is missing")
        }

        const rows: RowApplyPlan[] = []
        const rowSettlements: RowSettlementPlan[] = []
        const membershipInstalls: MembershipPlanNode[] = []
        const membershipSettlements: MembershipSettlementPlan[] = []
        const considered = new WeakSet<RowViewRecord>()
        const nodesByRecord = new WeakMap<
            MembershipRecord,
            MembershipPlanNode
        >()
        const nodesByScope = new Map<
            StoreScopeNode,
            Map<CollectionHandle, MembershipPlanNode>
        >()
        const collectionSlots: {
            readonly collection: CollectionHandle
            top: MembershipPlanNode | undefined
        }[] = []
        const slotsByCollection = new Map<
            CollectionHandle,
            (typeof collectionSlots)[number]
        >()
        type MembershipPresenceTransition = Readonly<{
            sequence: number
            present: boolean
        }>
        type MembershipPresenceTimeline = Readonly<{
            baselinePresent: boolean
            transitions: readonly MembershipPresenceTransition[]
            birth: EnablingBirth | undefined
        }>
        const noMembershipTransitions = Object.freeze(
            [],
        ) as readonly MembershipPresenceTransition[]
        const absentMembershipTimeline: MembershipPresenceTimeline = {
            baselinePresent: false,
            transitions: noMembershipTransitions,
            birth: undefined,
        }
        const presentMembershipTimeline: MembershipPresenceTimeline = {
            baselinePresent: true,
            transitions: noMembershipTransitions,
            birth: BASELINE_BIRTH,
        }
        const placementsByNode = new Map<
            MembershipPlanNode,
            Map<CollectionRowHandle, MembershipPresenceTimeline>
        >()
        const baselineRowsByNode = new Map<
            MembershipPlanNode,
            Set<CollectionRowHandle>
        >()

        const rememberNode = (node: MembershipPlanNode): void => {
            let byCollection = nodesByScope.get(node.scope)
            if (byCollection === undefined) {
                byCollection = new Map()
                nodesByScope.set(node.scope, byCollection)
            }
            byCollection.set(node.atom, node)
            if (node.existing !== undefined) {
                nodesByRecord.set(node.existing, node)
            }
        }

        const nodeForRecord = (
            target: MembershipRecord,
        ): MembershipPlanNode => {
            const current = nodesByRecord.get(target)
            if (current !== undefined) return current
            const unresolved: MembershipRecord[] = []
            let record: MembershipRecord | undefined = target
            let parent: MembershipPlanNode | undefined
            while (record !== undefined) {
                const known = nodesByRecord.get(record)
                if (known !== undefined) {
                    parent = known
                    break
                }
                unresolved.push(record)
                record = record.inheritedFrom
            }
            for (let index = unresolved.length - 1; index >= 0; index--) {
                const existing = unresolved[index] as MembershipRecord
                const node: MembershipPlanNode = {
                    scope: existing.scope,
                    atom: existing.atom,
                    existing,
                    parent,
                    beforeRows: membershipRows(existing),
                    plannedChildren: [],
                    finalRows: undefined,
                    installed: undefined,
                    affected: false,
                    containsAffected: false,
                }
                rememberNode(node)
                parent = node
            }
            return parent as MembershipPlanNode
        }

        const ensureMembershipPath = (
            scope: StoreScopeNode,
            collection: CollectionHandle,
        ): MembershipPlanNode => {
            const known = nodesByScope.get(scope)?.get(collection)
            if (known !== undefined) return known
            const unresolved: StoreScopeNode[] = []
            let currentScope: StoreScopeNode | undefined = scope
            let parent: MembershipPlanNode | undefined
            while (currentScope !== undefined) {
                const planned = nodesByScope
                    .get(currentScope)
                    ?.get(collection)
                if (planned !== undefined) {
                    parent = planned
                    break
                }
                const existing = scopeSidecars
                    .get(currentScope)
                    ?.memberships?.get(collection)
                if (existing !== undefined) {
                    parent = nodeForRecord(existing)
                    break
                }
                unresolved.push(currentScope)
                currentScope = currentScope.parent
            }
            for (let index = unresolved.length - 1; index >= 0; index--) {
                const node: MembershipPlanNode = {
                    scope: unresolved[index] as StoreScopeNode,
                    atom: collection,
                    existing: undefined,
                    parent,
                    beforeRows: parent?.beforeRows ?? EMPTY_ROWS,
                    plannedChildren: [],
                    finalRows: undefined,
                    installed: undefined,
                    affected: false,
                    containsAffected: false,
                }
                parent?.plannedChildren.push(node)
                membershipInstalls.push(node)
                rememberNode(node)
                parent = node
            }
            return parent as MembershipPlanNode
        }

        const collectionSlot = (collection: CollectionHandle) => {
            let slot = slotsByCollection.get(collection)
            if (slot !== undefined) return slot
            slot = { collection, top: undefined }
            slotsByCollection.set(collection, slot)
            collectionSlots.push(slot)
            return slot
        }

        const markAffected = (
            slot: (typeof collectionSlots)[number],
            node: MembershipPlanNode,
        ): void => {
            node.affected = true
            const previousTop = slot.top
            if (previousTop === undefined) slot.top = node
            let firstPreviouslyMarked: MembershipPlanNode | undefined
            let current: MembershipPlanNode | undefined = node
            while (current !== undefined) {
                if (current.containsAffected) {
                    firstPreviouslyMarked ??= current
                    if (Object.is(current, previousTop)) return
                } else {
                    current.containsAffected = true
                }
                current = current.parent
            }
            if (previousTop !== undefined) {
                slot.top = firstPreviouslyMarked as MembershipPlanNode
            }
        }

        const baselineContains = (
            node: MembershipPlanNode,
            row: CollectionRowHandle,
        ): boolean => {
            let rows = baselineRowsByNode.get(node)
            if (rows === undefined) {
                rows = new Set(node.beforeRows)
                baselineRowsByNode.set(node, rows)
            }
            return rows.has(row)
        }

        const mergeMembershipTimeline = (
            node: MembershipPlanNode,
            row: CollectionRowHandle,
            parent: MembershipPresenceTimeline,
            events: readonly PresenceEvent[] | undefined,
        ): MembershipPresenceTimeline => {
            if (membershipPlacementTraceForTest !== undefined) {
                membershipPlacementTraceForTest.states++
            }
            let local = committedLocal(node.scope, row).kind
            if (events === undefined) {
                return local === "none"
                    ? parent
                    : local === "present"
                      ? presentMembershipTimeline
                      : absentMembershipTimeline
            }

            let parentPresent = parent.baselinePresent
            let present =
                local === "present" ||
                (local === "none" && parentPresent)
            const baselinePresent = present
            let birth: EnablingBirth | undefined = present
                ? BASELINE_BIRTH
                : undefined
            const transitions: MembershipPresenceTransition[] = []
            let parentIndex = 0
            let eventIndex = 0
            while (
                parentIndex < parent.transitions.length ||
                eventIndex < events.length
            ) {
                const parentTransition = parent.transitions[parentIndex]
                const event = events[eventIndex]
                let sequence: number
                if (
                    parentTransition !== undefined &&
                    (event === undefined ||
                        parentTransition.sequence < event.sequence)
                ) {
                    parentPresent = parentTransition.present
                    sequence = parentTransition.sequence
                    parentIndex++
                } else {
                    local =
                        event!.kind === "present"
                            ? "present"
                            : event!.kind === "absent"
                              ? "absent"
                              : "none"
                    sequence = event!.sequence
                    eventIndex++
                }
                const nextPresent =
                    local === "present" ||
                    (local === "none" && parentPresent)
                if (nextPresent === present) continue
                present = nextPresent
                birth = present ? sequence : undefined
                transitions.push({ sequence, present })
            }
            if (transitions.length === 0) {
                return present
                    ? presentMembershipTimeline
                    : absentMembershipTimeline
            }
            return { baselinePresent, transitions, birth }
        }

        const placementsFor = (
            target: MembershipPlanNode,
        ): Map<CollectionRowHandle, MembershipPresenceTimeline> => {
            const known = placementsByNode.get(target)
            if (known !== undefined) return known
            const unresolved: MembershipPlanNode[] = []
            let current: MembershipPlanNode | undefined = target
            while (
                current !== undefined &&
                !placementsByNode.has(current)
            ) {
                unresolved.push(current)
                current = current.parent
            }
            let parentPlacements =
                current === undefined
                    ? new Map<
                          CollectionRowHandle,
                          MembershipPresenceTimeline
                      >()
                    : (placementsByNode.get(current) as Map<
                          CollectionRowHandle,
                          MembershipPresenceTimeline
                      >)
            for (let index = unresolved.length - 1; index >= 0; index--) {
                const node = unresolved[index] as MembershipPlanNode
                const eventsByRow = new Map<
                    CollectionRowHandle,
                    PresenceEvent[]
                >()
                for (const event of lane.historyByCollectionScope
                    .get(node.atom)
                    ?.get(node.scope) ?? []) {
                    let events = eventsByRow.get(event.row)
                    if (events === undefined) {
                        events = []
                        eventsByRow.set(event.row, events)
                    }
                    events.push(event)
                }
                const placements = new Map<
                    CollectionRowHandle,
                    MembershipPresenceTimeline
                >()
                for (const [row, parentTimeline] of parentPlacements) {
                    placements.set(
                        row,
                        mergeMembershipTimeline(
                            node,
                            row,
                            parentTimeline,
                            eventsByRow.get(row),
                        ),
                    )
                    eventsByRow.delete(row)
                }
                for (const [row, events] of eventsByRow) {
                    const parentTimeline =
                        node.parent !== undefined &&
                        baselineContains(node.parent, row)
                            ? presentMembershipTimeline
                            : absentMembershipTimeline
                    placements.set(
                        row,
                        mergeMembershipTimeline(
                            node,
                            row,
                            parentTimeline,
                            events,
                        ),
                    )
                }
                placementsByNode.set(node, placements)
                parentPlacements = placements
            }
            return placementsByNode.get(target) as Map<
                CollectionRowHandle,
                MembershipPresenceTimeline
            >
        }

        const finalRowsFor = (
            node: MembershipPlanNode,
        ): readonly CollectionRowHandle[] => {
            if (node.finalRows !== undefined) return node.finalRows
            if (node.existing !== undefined) {
                membershipRebuildTraceForTest?.push(node.existing)
            }
            const next: CollectionRowHandle[] = []
            const births: {
                readonly row: CollectionRowHandle
                readonly birth: number
            }[] = []
            if (readBaselineOverride === undefined) {
                const placements = placementsFor(node)
                for (const row of node.beforeRows) {
                    const placement = placements.get(row)
                    if (
                        placement === undefined ||
                        placement.birth === BASELINE_BIRTH
                    ) {
                        next.push(row)
                    }
                }
                for (const [row, placement] of placements) {
                    if (typeof placement.birth === "number") {
                        births.push({ row, birth: placement.birth })
                    }
                }
            } else {
                const candidates = new Map<
                    CollectionRowHandle,
                    DraftCoordinate
                >()
                const history = lane.historyByCollectionScope.get(node.atom)
                let currentScope: StoreScopeNode | undefined = node.scope
                while (currentScope !== undefined) {
                    for (const event of history?.get(currentScope) ?? []) {
                        if (!candidates.has(event.row)) {
                            candidates.set(
                                event.row,
                                coordinateFor(
                                    draft,
                                    node.scope,
                                    event.row,
                                    node.atom,
                                ),
                            )
                        }
                    }
                    currentScope = currentScope.parent
                }
                for (const row of node.beforeRows) {
                    const coordinate = candidates.get(row)
                    if (
                        coordinate === undefined ||
                        coordinate.enablingBirth === BASELINE_BIRTH
                    ) {
                        next.push(row)
                    }
                }
                for (const coordinate of candidates.values()) {
                    if (
                        typeof coordinate.enablingBirth === "number" &&
                        draftOutcome(
                            lane,
                            coordinate.scope,
                            coordinate.row,
                            coordinate.collection,
                        ).kind === "present"
                    ) {
                        births.push({
                            row: coordinate.row,
                            birth: coordinate.enablingBirth,
                        })
                    }
                }
            }
            births.sort((first, second) => {
                return first.birth - second.birth
            })
            for (const birth of births) next.push(birth.row)
            node.finalRows =
                node.existing !== undefined && sameRows(node.beforeRows, next)
                    ? node.beforeRows
                    : Object.freeze(next)
            return node.finalRows
        }

        for (const coordinate of lane.planOrder) {
            const final = coordinate.final
            if (final === undefined) continue
            const local =
                final.kind === "present"
                    ? presentLocal(final.value)
                    : final.kind === "absent" &&
                        coordinate.scope.parent !== undefined
                      ? ABSENT_LOCAL
                      : NONE
            const ownershipChanged = !sameLocal(
                committedLocal(coordinate.scope, coordinate.row),
                local,
            )
            rows.push(Object.freeze({ coordinate, local, ownershipChanged }))

            const slot = collectionSlot(coordinate.collection)
            const baseline = freezeBaseline(
                readBaseline(
                    coordinate.scope,
                    coordinate.row,
                    coordinate.collection,
                ),
            )
            const localKindChanged = baseline.local.kind !== local.kind
            if (localKindChanged) {
                ensureMembershipPath(
                    coordinate.scope,
                    coordinate.collection,
                )
            }
            const baselinePlacement =
                baseline.effective.kind === "present"
                    ? BASELINE_BIRTH
                    : undefined
            if (!Object.is(baselinePlacement, coordinate.enablingBirth)) {
                markAffected(
                    slot,
                    ensureMembershipPath(
                        coordinate.scope,
                        coordinate.collection,
                    ),
                )
            }

            const materialized = scopeSidecars
                .get(coordinate.scope)
                ?.rowViews?.get(coordinate.row)
            if (materialized === undefined) continue
            const pending = [materialized]
            while (pending.length !== 0) {
                const record = pending.pop() as RowViewRecord
                if (considered.has(record)) continue
                considered.add(record)
                const before =
                    record.served.outcome.kind === "value" &&
                    record.served.outcome.value !== undefined
                        ? presentOutcome(record.served.outcome.value)
                        : ABSENT
                const after = draftOutcome(
                    lane,
                    record.scope,
                    record.atom,
                    coordinate.collection,
                )
                if (sameOutcome(before, after)) continue
                rowSettlements.push(
                    Object.freeze({
                        scope: record.scope,
                        atom: record.atom as AnyState,
                        record,
                        outcome: after,
                    }),
                )
                const children: RowViewRecord[] = []
                record.inheritingChildren.forEach(child => {
                    record.scope.coordinator.recordCounter("routeVisits")
                    children.push(child)
                })
                for (let index = children.length - 1; index >= 0; index--) {
                    pending.push(children[index] as RowViewRecord)
                }
            }
        }

        for (const slot of collectionSlots) {
            const top = slot.top
            if (top === undefined) continue
            const visited = new Set<MembershipPlanNode>()
            const pending: {
                readonly node: MembershipPlanNode
                readonly affected: boolean
            }[] = [{ node: top, affected: false }]
            while (pending.length !== 0) {
                const entry = pending.pop()!
                const node = entry.node
                if (visited.has(node)) continue
                visited.add(node)
                const affected = entry.affected || node.affected
                if (affected) {
                    const finalRows = finalRowsFor(node)
                    if (
                        node.existing !== undefined &&
                        !Object.is(finalRows, node.beforeRows)
                    ) {
                        membershipSettlements.push(
                            Object.freeze({
                                scope: node.scope,
                                atom: node.atom as AnyState,
                                node,
                                record: node.existing,
                                rows: finalRows,
                            }),
                        )
                    }
                }
                const children: MembershipPlanNode[] = []
                node.existing?.inheritingChildren.forEach(child => {
                    node.scope.coordinator.recordCounter("routeVisits")
                    const childNode = affected
                        ? nodeForRecord(child)
                        : nodesByRecord.get(child)
                    if (
                        childNode !== undefined &&
                        (affected || childNode.containsAffected)
                    ) {
                        children.push(childNode)
                    }
                })
                for (const child of node.plannedChildren) {
                    if (affected || child.containsAffected) children.push(child)
                }
                for (let index = children.length - 1; index >= 0; index--) {
                    pending.push({
                        node: children[index] as MembershipPlanNode,
                        affected,
                    })
                }
            }
        }
        for (const node of membershipInstalls) finalRowsFor(node)
        const plan: ScopedCollectionCommitPlan = {
            kind: "collection-commit-plan",
            commit: commitPlan,
            rows: Object.freeze(rows),
            rowSettlements: Object.freeze(rowSettlements),
            membershipInstalls: Object.freeze(membershipInstalls),
            membershipSettlements: Object.freeze(membershipSettlements),
            sources: Object.freeze([
                ...rowSettlements,
                ...membershipSettlements,
            ]),
        }
        return plan
    }

    const applyCommit = (planValue: CollectionCommitPlan): boolean => {
        const plan = planValue as ScopedCollectionCommitPlan
        let ownershipChanged = false
        for (const rowPlan of plan.rows) {
            if (!rowPlan.ownershipChanged) continue
            ownershipChanged = true
            const { row, scope } = rowPlan.coordinate
            if (rowPlan.local.kind === "none") {
                const sidecar = scopeSidecars.get(scope)
                sidecar?.rowLocals?.delete(row)
                sidecar?.ownedRows?.delete(row)
                if (sidecar?.ownedRows?.size === 0) {
                    sidecar.ownedRows = undefined
                    sidecar.rowLocals = undefined
                    if (
                        sidecar.liveRowViews === undefined &&
                        sidecar.liveMemberships === undefined
                    ) {
                        scopeSidecars.delete(scope)
                    }
                }
                continue
            }
            const sidecar = sidecarFor(scope)
            let rowLocals = sidecar.rowLocals
            if (rowLocals === undefined) {
                rowLocals = new WeakMap()
                sidecar.rowLocals = rowLocals
            }
            let ownedRows = sidecar.ownedRows
            if (ownedRows === undefined) {
                ownedRows = new Set()
                sidecar.ownedRows = ownedRows
            }
            rowLocals.set(row, rowPlan.local)
            ownedRows.add(row)
        }
        for (const node of plan.membershipInstalls) {
            node.installed = registerMembershipRecord(
                node.scope,
                node.atom,
                node.finalRows as readonly CollectionRowHandle[],
            )
        }
        if (plan.membershipSettlements.length !== 0) return true
        for (const node of plan.membershipInstalls) {
            if (!sameRows(node.beforeRows, node.finalRows!)) return true
        }
        return ownershipChanged
    }

    const rewireCommit = (planValue: CollectionCommitPlan): void => {
        const plan = planValue as ScopedCollectionCommitPlan
        for (const rowPlan of plan.rows) {
            if (!rowPlan.ownershipChanged) continue
            const { row, scope } = rowPlan.coordinate
            const record = scopeSidecars.get(scope)?.rowViews?.get(row)
            if (record === undefined) continue
            if (rowPlan.local.kind !== "none" || scope.parent === undefined) {
                detachRowView(record)
            } else {
                attachRowView(record, materializeRowView(scope.parent, row))
            }
        }
        for (const node of plan.membershipInstalls) {
            const record = node.installed
            const parent = node.parent?.existing ?? node.parent?.installed
            if (record !== undefined && parent !== undefined) {
                attachMembership(record, parent)
            }
        }
    }

    const settleCommit = (
        planValue: CollectionCommitPlan,
    ): readonly CollectionCommitSource[] | undefined => {
        const plan = planValue as ScopedCollectionCommitPlan
        for (const settlement of plan.rowSettlements) {
            const { record, outcome } = settlement
            record.served = Object.freeze({
                token: record.scope.createOutcomeToken(),
                outcome: servedOutcome(outcome),
            })
            record.scope.coordinator.reachSubscriptionTarget(
                record.scope,
                record.atom as AnyState,
            )
        }
        for (const settlement of plan.membershipSettlements) {
            const { record, rows } = settlement
            record.served = Object.freeze({
                token: record.scope.createOutcomeToken(),
                outcome: Object.freeze({ kind: "value", value: rows }),
            })
            record.scope.coordinator.reachSubscriptionTarget(
                record.scope,
                record.atom as AnyState,
            )
        }
        return plan.sources.length === 0 ? undefined : plan.sources
    }

    const commitPlan = function (
        this: ScopedCollectionCommitPlan,
        _host: object,
        phase: 0 | 1 | 2,
    ) {
        if (phase === 0) return applyCommit(this)
        if (phase === 1) return rewireCommit(this)
        return settleCommit(this)
    } as CollectionCommitPlan["commit"]

    const disposeScope = (scopeValue: object): void => {
        const scope = scopeValue as StoreScopeNode
        const sidecar = scopeSidecars.get(scope)
        if (sidecar === undefined) return
        sidecar.liveRowViews?.forEach(record => {
            detachRowView(record)
            record.inheritingChildren.clear()
        })
        sidecar.liveMemberships?.forEach(record => {
            detachMembership(record)
            record.inheritingChildren.clear()
            record.served = Object.freeze({
                token: record.served.token,
                outcome: Object.freeze({ kind: "value", value: EMPTY_ROWS }),
            })
        })
        sidecar.liveRowViews?.clear()
        sidecar.liveMemberships?.clear()
        sidecar.ownedRows?.clear()
        sidecar.rowLocals = undefined
        sidecar.ownedRows = undefined
        sidecar.rowViews = undefined
        sidecar.liveRowViews = undefined
        sidecar.memberships = undefined
        sidecar.liveMemberships = undefined
        scopeSidecars.delete(scope)
    }

    const kernel: CollectionDraftKernel = Object.freeze({
        has: (node: AnyState): boolean =>
            bindings.lookupRow(node) !== undefined ||
            bindings.lookupCollection(node),
        read: (
            draftValue: object,
            scopeValue: object,
            node: AnyState,
        ): SynchronousResult => {
            const draft = draftValue as TreeDraft
            const scope = scopeValue as StoreScopeNode
            if (bindings.lookupRow(node) !== undefined) {
                return Object.freeze({
                    kind: "value",
                    value: readDraftRow(draft, scope, node),
                })
            }
            if (bindings.lookupCollection(node)) {
                return Object.freeze({
                    kind: "value",
                    value: readDraftCollection(draft, scope, node),
                })
            }
            throw new TypeError("Unknown collection scratch source")
        },
        stage: (
            draftValue: object,
            scopeValue: object,
            operation: CollectionMutationKind,
            row: AnyState,
            input: unknown,
            session: ControlFaultSession,
        ): void => {
            const draft = draftValue as TreeDraft
            const scope = scopeValue as StoreScopeNode
            if (operation === "set") {
                stageSet(draft, scope, row, input, session)
            } else if (operation === "update") {
                stageUpdate(draft, scope, row, input, session)
            } else if (operation === "delete") {
                stageDelete(draft, scope, row)
            } else {
                stageReset(draft, scope, row)
            }
        },
        scope: (scopeValue: object, node?: AnyState) => {
            if (node === undefined) {
                disposeScope(scopeValue)
                return undefined
            }
            if (bindings.lookupRow(node) !== undefined) {
                return materializeRowView(scopeValue as StoreScopeNode, node)
                    .served
            }
            if (!bindings.lookupCollection(node)) return undefined
            return materializeMembership(
                scopeValue as StoreScopeNode,
                node,
            ).served
        },
        plan: (_host: object, draftValue: object) => planCommit(draftValue),
        release: releaseDraft,
        stageSet,
        stageUpdate,
        stageDelete,
        stageReset,
        readDraftRow,
        readDraftCollection,
        beginMembershipRebuildTraceForTest: () => {
            if (membershipRebuildTraceForTest !== undefined) {
                throw new Error("A membership rebuild trace is already active")
            }
            let trace: object[] | undefined = []
            membershipRebuildTraceForTest = trace
            return () => {
                if (trace === undefined) {
                    throw new Error("The membership rebuild trace is already finished")
                }
                membershipRebuildTraceForTest = undefined
                const result = Object.freeze([...trace])
                trace.length = 0
                trace = undefined
                return result
            }
        },
        beginMembershipPlacementTraceForTest: () => {
            if (membershipPlacementTraceForTest !== undefined) {
                throw new Error("A membership placement trace is already active")
            }
            let trace:
                | { coordinates: number; states: number }
                | undefined = { coordinates: 0, states: 0 }
            membershipPlacementTraceForTest = trace
            return () => {
                if (trace === undefined) {
                    throw new Error("The membership placement trace is already finished")
                }
                membershipPlacementTraceForTest = undefined
                const result = Object.freeze({ ...trace })
                trace = undefined
                return result
            }
        },
        hasDraftLane: (draft: TreeDraft): boolean => lanes.has(draft),
        inspectDraft,
    })
    return kernel
}
