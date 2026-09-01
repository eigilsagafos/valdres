import {
    createInternalStoreTreeInstrumentation,
    SubscriberNotificationError,
    type InternalStoreTreeInstrumentation,
    type InternalStoreTreeTrace,
} from "./committed-store-tree/committed-store-tree"
import type {
    StoreScopeNode,
    StoreTreeCounter,
} from "./committed-store-tree/scope-node"
import type { TreeDraft } from "./committed-store-tree/tree-transaction"
import type {
    CommittedStoreTree,
    State,
    TransactionCallback,
} from "./committed-store-tree/types"
import type {
    SelectorCycleSearch,
    SelectorCycleSearchSite,
    SelectorDefinition,
    SelectorEvaluationHost,
    SelectorEvaluationProposal,
    SelectorEvaluationStrategy,
    SelectorEvaluationSession,
} from "./selector-evaluator/types"
import { evaluateSelector } from "./selector-evaluator/evaluate"

type StoreRecorderEvent =
    | readonly [
          event: 0,
          operation: 0 | 1 | 2 | 3,
          scope: object,
          scopeName: string | undefined,
          name: string | undefined,
      ]
    | readonly [event: 1, result: 0 | 1, failurePhase?: 0 | 1]
    | readonly [event: 2]
    | readonly [event: 3, changedSources: number]
    | readonly [
          event: 5,
          intent: 0 | 2,
          scope: object,
          scopeName: string | undefined,
          atom: object,
          atomName: string | undefined,
      ]

export type InspectionJsonPrimitive = string | number | boolean | null

export type InspectionJsonValue =
    | InspectionJsonPrimitive
    | readonly InspectionJsonValue[]
    | InspectionJsonObject

export interface InspectionJsonObject {
    readonly [key: string]: InspectionJsonValue
}

export type InspectionReferenceKind =
    | "store"
    | "scope"
    | "state"
    | "atom"
    | "selector"
    | "scratch-host"
    | "subscription"
    | "callback"

export type InspectionReference = Readonly<{
    id: number
    kind: InspectionReferenceKind
    name?: string
}> &
    InspectionJsonObject

export interface InspectionCycleBucket {
    readonly searches: number
    readonly visits: number
    readonly maxVisits: number
    readonly found: number
}

export interface InspectionCycleTotals {
    readonly searches: number
    readonly visits: number
    readonly maxVisits: number
    readonly found: number
    readonly bySite: Readonly<{
        prefixRevalidation: number
        newEdgeProof: number
    }>
    readonly byHost: Readonly<{
        committed: number
        scratch: number
        hydration: number
    }>
    readonly byLane: Readonly<{
        committed: Readonly<{
            prefixRevalidation: InspectionCycleBucket
            newEdgeProof: InspectionCycleBucket
        }>
        scratch: Readonly<{
            prefixRevalidation: InspectionCycleBucket
            newEdgeProof: InspectionCycleBucket
        }>
        hydration: Readonly<{
            prefixRevalidation: InspectionCycleBucket
            newEdgeProof: InspectionCycleBucket
        }>
    }>
}

export interface InspectionWorkTotals {
    readonly selectorEvaluations: number
    readonly proposedTopologyChanges: number
    readonly proposedTopologyIdentical: number
    readonly transientSelectorHostsCreated: number
    readonly propagationSettled: number
    readonly notificationTargets: number
    readonly subscriberCallbacks: number
    readonly cycle: InspectionCycleTotals
}

interface InspectionCorrelationLinks {
    readonly spanId?: number
    readonly operationId?: number
    readonly commitId?: number
    readonly sessionId?: number
    readonly evaluationId?: number
    readonly searchId?: number
}

interface InspectionIntervalBase extends InspectionCorrelationLinks {
    readonly seqStart: number
    readonly seqEnd: number
    readonly startUs: number
    readonly durationUs: number
}

export interface SpanInspection extends InspectionIntervalBase {
    readonly type: "span"
    readonly spanId: number
    readonly parentSpanId?: number
    readonly name: string
    readonly result: "returned" | "threw" | "async-rejected"
    readonly totals: InspectionWorkTotals
}

export interface OperationInspection extends InspectionIntervalBase {
    readonly type: "operation"
    readonly operationId: number
    readonly spanId?: number
    readonly operation: "set" | "update" | "reset" | "transaction"
    readonly name?: string
    readonly scope?: InspectionReference
    readonly commitId?: number
    readonly result: "returned" | "threw"
    readonly effect:
        | "none"
        | "committed"
        | "committed-with-propagation-error"
        | "committed-with-notification-error"
    readonly totals: InspectionWorkTotals
}

export interface CommitInspection extends InspectionIntervalBase {
    readonly type: "commit"
    readonly commitId: number
    readonly operationId: number
    readonly spanId?: number
    readonly intents: number
    readonly changedSources: number
    readonly ownershipChanged: boolean
    readonly sourceApplied: boolean
    readonly notificationsCompleted: boolean
    readonly totals: InspectionWorkTotals
}

export type InspectionSummary =
    | SpanInspection
    | OperationInspection
    | CommitInspection

interface InspectionDetailLinks extends InspectionCorrelationLinks {
    readonly sequence?: number
    readonly seqStart?: number
    readonly seqEnd?: number
    readonly timeUs?: number
    readonly startUs?: number
    readonly durationUs?: number
}

export interface IntentInspectionDetail extends InspectionDetailLinks {
    readonly type: "intent"
    /** Final canonical commit intent. Updaters resolve to `set` before commit. */
    readonly intent: "set" | "reset"
    readonly scope: InspectionReference
    readonly atom: InspectionReference
}

interface SelectorEvaluationInspectionBase extends InspectionDetailLinks {
    readonly type: "selector-evaluation"
    readonly host: "committed" | "scratch" | "hydration"
    readonly hostRef: InspectionReference
    readonly selector: InspectionReference
    readonly graphVersionStart: number
    readonly graphVersionEnd: number
    readonly previousDependencyCount: number
}

export type SelectorEvaluationInspectionDetail =
    SelectorEvaluationInspectionBase &
        (
            | Readonly<{
                  outcome: "value" | "error" | "control-error"
                  dependencyCount: number
                  proposedTopologyChanged: boolean
                  proposedEdgesAdded: number
                  proposedEdgesRemoved: number
              }>
            | Readonly<{ outcome: "threw" }>
        )

export interface CycleSearchInspectionDetail extends InspectionDetailLinks {
    readonly type: "cycle-search"
    readonly site: "prefix-revalidation" | "new-edge-proof"
    readonly host: "committed" | "scratch" | "hydration"
    readonly hostRef: InspectionReference
    readonly start: InspectionJsonValue
    readonly target: InspectionJsonValue
    readonly graphVersion: number
    readonly attributedSessionPublications: number
    readonly evaluationGraphVersionDelta: number
    readonly evaluationAttributedPublicationDelta: number
    readonly acceptedPrefixLength: number
    readonly parentWasCold: boolean
    readonly visits: number
    readonly edges: number
    readonly maxFrontier: number
    readonly transientExpansions: number
    readonly recordExpansions: number
    readonly terminalPrunes: number
    readonly found: boolean
    readonly path?: readonly InspectionJsonValue[]
}

export type InspectionDetail =
    | IntentInspectionDetail
    | SelectorEvaluationInspectionDetail
    | CycleSearchInspectionDetail

export type InspectionDetailType = InspectionDetail["type"]

export interface InspectionOverflow {
    readonly summaries: number
    readonly details: number
    readonly retained: Readonly<{
        summaries?: Readonly<{ firstSequence: number; lastSequence: number }>
        details?: Readonly<{ firstSequence: number; lastSequence: number }>
    }>
}

export interface InspectionRecorderFault {
    readonly type: "recorder-fault"
    readonly phase: string
    readonly sequence: number
}

export interface InspectionExport {
    readonly schema: "valdres.inspect"
    readonly schemaVersion: 1
    readonly recordingId: string
    readonly summaries: readonly InspectionSummary[]
    readonly details: readonly InspectionDetail[]
    readonly complete: boolean
    readonly overflow: InspectionOverflow
    readonly fault?: InspectionRecorderFault
}

export interface InspectableStoreOptions {
    readonly capacity?: Readonly<{
        /** Completed span, operation, and commit records. Default: 2,048. */
        summaries?: number
        /** Fine-grained structural records. Default: 100,000. */
        details?: number
    }>
}

/** A point-in-time, value-free correlation token for companion adapters. */
export interface InspectionCapture {
    readonly recordingId: string
    readonly timeUs: number
    readonly monotonicTimeMs: number
    readonly store: InspectionReference
    readonly state?: InspectionReference
    readonly spanId?: number
    readonly operationId?: number
    readonly commitId?: number
    readonly sessionId?: number
    readonly evaluationId?: number
    readonly searchId?: number
}

export interface StateInspectionCapture extends InspectionCapture {
    readonly state: InspectionReference
}

type SynchronousInspectionResult<Result> =
    Result extends PromiseLike<unknown> ? never : Result

export interface StoreInspector {
    readonly recordingId: string
    capture(store: CommittedStoreTree): InspectionCapture
    capture<Value>(
        store: CommittedStoreTree,
        state: State<Value>,
    ): StateInspectionCapture
    span<Result>(
        name: string,
        callback: () => SynchronousInspectionResult<Result>,
    ): Result
    export(): InspectionExport
    reset(): void
}

export type InternalInspectionIntervalType =
    | "span"
    | "operation"
    | "commit"
    | "selector-evaluation"
    | "cycle-search"
    | "propagation"
    | "notification"

export interface InternalInspectionLinks {
    readonly spanId?: number
    readonly operationId?: number
    readonly commitId?: number
    readonly sessionId?: number
    readonly evaluationId?: number
    readonly searchId?: number
}

export interface InternalInspectionIntervalInput {
    readonly type: InternalInspectionIntervalType
    readonly name?: string
    readonly links?: InternalInspectionLinks
    readonly fields?: Readonly<Record<string, InspectionJsonValue | undefined>>
}

export interface InternalInspectionIntervalFinish {
    readonly result?: "returned" | "threw" | "async-rejected"
    readonly fields?: Readonly<Record<string, InspectionJsonValue | undefined>>
}

export interface InternalInspectionDetailInput {
    readonly type: "intent"
    readonly links?: InternalInspectionLinks
    readonly fields?: Readonly<Record<string, InspectionJsonValue | undefined>>
}

export interface InternalInspectionIntervalToken {
    readonly id: number
    readonly type: InternalInspectionIntervalType
}

export interface InspectionWorkDelta {
    readonly selectorEvaluations?: number
    readonly proposedTopologyChanges?: number
    readonly proposedTopologyIdentical?: number
    readonly transientSelectorHostsCreated?: number
    readonly propagationSettled?: number
    readonly notificationTargets?: number
    readonly subscriberCallbacks?: number
    readonly cycle?: Readonly<{
        searches?: number
        visits?: number
        maxVisits?: number
        found?: number
        site?: "prefix-revalidation" | "new-edge-proof"
        host?: "committed" | "scratch" | "hydration"
    }>
}

export interface InternalInspectionRecorder {
    recordStoreEvent(...event: StoreRecorderEvent): void
    hasActiveStoreOperation(): boolean
    findDependencyPath<Node, Token extends object>(
        hostKind: "committed" | "scratch" | "hydration",
        hostRef: InspectionReference,
        start: Node,
        target: Node,
        host: SelectorEvaluationHost<Node, Token>,
        session: SelectorEvaluationSession<Node>,
        site: SelectorCycleSearchSite,
        evaluationGraphVersionStart: number,
        evaluationAttributedPublicationStart: number,
        parentWasCold: boolean,
    ): readonly Node[] | undefined
    reference(
        target: object,
        kind: InspectionReferenceKind,
        name?: string,
    ): InspectionReference
    beginInterval(
        input: InternalInspectionIntervalInput,
    ): InternalInspectionIntervalToken
    finishInterval(
        token: InternalInspectionIntervalToken,
        finish?: InternalInspectionIntervalFinish,
    ): void
    record(input: InternalInspectionDetailInput): void
    addWork(delta: InspectionWorkDelta): void
}

export interface InternalInspectionSetup {
    readonly recorder: InternalInspectionRecorder
    readonly inspect: StoreInspector
    readonly instrumentation: InternalStoreTreeInstrumentation
    readonly trace: InternalStoreTreeTrace
}

interface MutableCycleTotals {
    searches: number
    visits: number
    maxVisits: number
    found: number
    prefixRevalidation: number
    newEdgeProof: number
    committed: number
    scratch: number
    hydration: number
    lanes: Record<
        "committed" | "scratch" | "hydration",
        Record<
            "prefixRevalidation" | "newEdgeProof",
            {
                searches: number
                visits: number
                maxVisits: number
                found: number
            }
        >
    >
}

interface MutableWorkTotals {
    selectorEvaluations: number
    proposedTopologyChanges: number
    proposedTopologyIdentical: number
    transientSelectorHostsCreated: number
    propagationSettled: number
    notificationTargets: number
    subscriberCallbacks: number
    cycle: MutableCycleTotals
}

interface ActiveInterval {
    readonly token: InternalInspectionIntervalToken
    readonly parentId: number | undefined
    readonly links: InternalInspectionLinks
    readonly name: string | undefined
    readonly seqStart: number
    readonly startUs: number
    readonly fields: InspectionJsonObject
    readonly totals: MutableWorkTotals | undefined
    commitId: number | undefined
    commitSourceApplied: boolean
    commitChangedSources: number | undefined
    commitOwnershipChanged: boolean | undefined
    commitFailurePhase: "propagate" | "notify" | undefined
    operationIntents: number
    counterStart: CounterSnapshot | undefined
}

type CounterSnapshot = Readonly<{
    sourceEpoch: number
    transientSelectorHostsCreated: number
    propagationSettled: number
    notificationTargets: number
    subscriberCallbacks: number
}>

const DEFAULT_SUMMARY_CAPACITY = 2_048
const DEFAULT_DETAIL_CAPACITY = 100_000
const MAX_LABEL_LENGTH = 256
const MAX_STRING_LENGTH = 1_024
const MAX_COLLECTION_ENTRIES = 10_000
const MAX_JSON_DEPTH = 32
const MAX_JSON_NODES = 20_000
const SUMMARY_TYPES = new Set<InternalInspectionIntervalType>([
    "span",
    "operation",
    "commit",
])
const RESERVED_FIELD_KEYS = new Set([
    "type",
    "id",
    "sequence",
    "seqStart",
    "seqEnd",
    "startUs",
    "durationUs",
    "spanId",
    "parentSpanId",
    "operationId",
    "commitId",
    "evaluationId",
    "searchId",
    "name",
    "result",
    "totals",
])
const RAW_FIELD_KEYS = new Set([
    "value",
    "previousValue",
    "nextValue",
    "resultValue",
    "error",
    "callback",
    "updater",
])
const NOOP = (): void => {}
const DEPENDENCY_PATH_ROOT = Symbol("inspection dependency path root")

let nextRecordingId = 1

class BoundedRing<Value> {
    readonly #capacity: number
    readonly #items: Value[] = []
    #start = 0

    constructor(capacity: number) {
        this.#capacity = capacity
    }

    add(value: Value): boolean {
        if (this.#capacity === 0) return true
        if (this.#items.length < this.#capacity) {
            this.#items.push(value)
            return false
        }
        this.#items[this.#start] = value
        this.#start = (this.#start + 1) % this.#capacity
        return true
    }

    snapshot(): readonly Value[] {
        if (this.#items.length < this.#capacity || this.#start === 0) {
            return Object.freeze([...this.#items])
        }
        return Object.freeze([
            ...this.#items.slice(this.#start),
            ...this.#items.slice(0, this.#start),
        ])
    }
}

const retainedBounds = (
    records: readonly (InspectionSummary | InspectionDetail)[],
): Readonly<{ firstSequence: number; lastSequence: number }> | undefined => {
    if (records.length === 0) return undefined
    let firstSequence = Number.POSITIVE_INFINITY
    let lastSequence = 0
    for (const record of records) {
        const sequence = "sequence" in record ? record.sequence : undefined
        firstSequence = Math.min(
            firstSequence,
            record.seqStart ?? sequence ?? 0,
        )
        lastSequence = Math.max(lastSequence, record.seqEnd ?? sequence ?? 0)
    }
    return Object.freeze({ firstSequence, lastSequence })
}

const readCapacity = (
    value: number | undefined,
    fallback: number,
    label: string,
    allowZero: boolean,
): number => {
    const capacity = value ?? fallback
    if (!Number.isSafeInteger(capacity) || capacity < (allowZero ? 0 : 1)) {
        throw new TypeError(
            `${label} capacity must be ${allowZero ? "a non-negative" : "a positive"} safe integer`,
        )
    }
    return capacity
}

const normalizeLabel = (label: string): string =>
    label.length <= MAX_LABEL_LENGTH ? label : label.slice(0, MAX_LABEL_LENGTH)

const createMutableCycleBucket = () => ({
    searches: 0,
    visits: 0,
    maxVisits: 0,
    found: 0,
})

const createMutableTotals = (): MutableWorkTotals => ({
    selectorEvaluations: 0,
    proposedTopologyChanges: 0,
    proposedTopologyIdentical: 0,
    transientSelectorHostsCreated: 0,
    propagationSettled: 0,
    notificationTargets: 0,
    subscriberCallbacks: 0,
    cycle: {
        searches: 0,
        visits: 0,
        maxVisits: 0,
        found: 0,
        prefixRevalidation: 0,
        newEdgeProof: 0,
        committed: 0,
        scratch: 0,
        hydration: 0,
        lanes: {
            committed: {
                prefixRevalidation: createMutableCycleBucket(),
                newEdgeProof: createMutableCycleBucket(),
            },
            scratch: {
                prefixRevalidation: createMutableCycleBucket(),
                newEdgeProof: createMutableCycleBucket(),
            },
            hydration: {
                prefixRevalidation: createMutableCycleBucket(),
                newEdgeProof: createMutableCycleBucket(),
            },
        },
    },
})

const freezeTotals = (totals: MutableWorkTotals): InspectionWorkTotals =>
    Object.freeze({
        selectorEvaluations: totals.selectorEvaluations,
        proposedTopologyChanges: totals.proposedTopologyChanges,
        proposedTopologyIdentical: totals.proposedTopologyIdentical,
        transientSelectorHostsCreated: totals.transientSelectorHostsCreated,
        propagationSettled: totals.propagationSettled,
        notificationTargets: totals.notificationTargets,
        subscriberCallbacks: totals.subscriberCallbacks,
        cycle: Object.freeze({
            searches: totals.cycle.searches,
            visits: totals.cycle.visits,
            maxVisits: totals.cycle.maxVisits,
            found: totals.cycle.found,
            bySite: Object.freeze({
                prefixRevalidation: totals.cycle.prefixRevalidation,
                newEdgeProof: totals.cycle.newEdgeProof,
            }),
            byHost: Object.freeze({
                committed: totals.cycle.committed,
                scratch: totals.cycle.scratch,
                hydration: totals.cycle.hydration,
            }),
            byLane: Object.freeze({
                committed: Object.freeze({
                    prefixRevalidation: Object.freeze({
                        ...totals.cycle.lanes.committed.prefixRevalidation,
                    }),
                    newEdgeProof: Object.freeze({
                        ...totals.cycle.lanes.committed.newEdgeProof,
                    }),
                }),
                scratch: Object.freeze({
                    prefixRevalidation: Object.freeze({
                        ...totals.cycle.lanes.scratch.prefixRevalidation,
                    }),
                    newEdgeProof: Object.freeze({
                        ...totals.cycle.lanes.scratch.newEdgeProof,
                    }),
                }),
                hydration: Object.freeze({
                    prefixRevalidation: Object.freeze({
                        ...totals.cycle.lanes.hydration.prefixRevalidation,
                    }),
                    newEdgeProof: Object.freeze({
                        ...totals.cycle.lanes.hydration.newEdgeProof,
                    }),
                }),
            }),
        }),
    })

interface JsonBudget {
    remaining: number
}

const sanitizeJson = (
    value: unknown,
    budget: JsonBudget,
    ancestors: Set<object>,
    depth: number,
): InspectionJsonValue => {
    if (budget.remaining-- <= 0 || depth > MAX_JSON_DEPTH) return null
    if (value === null) return null
    if (typeof value === "string") {
        return value.length <= MAX_STRING_LENGTH
            ? value
            : value.slice(0, MAX_STRING_LENGTH)
    }
    if (typeof value === "boolean") return value
    if (typeof value === "number") return Number.isFinite(value) ? value : null
    if (typeof value !== "object") return null
    if (ancestors.has(value)) return null

    ancestors.add(value)
    try {
        if (Array.isArray(value)) {
            const copy: InspectionJsonValue[] = []
            const length = Math.min(value.length, MAX_COLLECTION_ENTRIES)
            for (let index = 0; index < length; index++) {
                copy.push(
                    sanitizeJson(value[index], budget, ancestors, depth + 1),
                )
            }
            return Object.freeze(copy)
        }

        const copy: Record<string, InspectionJsonValue> = {}
        const keys = Object.keys(value).slice(0, MAX_COLLECTION_ENTRIES)
        for (const key of keys) {
            if (RAW_FIELD_KEYS.has(key)) continue
            const member = Reflect.get(value, key)
            if (member === undefined) continue
            copy[key] = sanitizeJson(member, budget, ancestors, depth + 1)
        }
        return Object.freeze(copy)
    } finally {
        ancestors.delete(value)
    }
}

const sanitizeFields = (
    fields?: Readonly<Record<string, InspectionJsonValue | undefined>>,
): InspectionJsonObject => {
    if (fields === undefined) return EMPTY_FIELDS
    const copy: Record<string, InspectionJsonValue> = {}
    const budget = { remaining: MAX_JSON_NODES }
    for (const key of Object.keys(fields).slice(0, MAX_COLLECTION_ENTRIES)) {
        if (RESERVED_FIELD_KEYS.has(key) || RAW_FIELD_KEYS.has(key)) continue
        const value = fields[key]
        if (value === undefined) continue
        copy[key] = sanitizeJson(value, budget, new Set(), 0)
    }
    return Object.freeze(copy)
}

const EMPTY_FIELDS = Object.freeze({}) as InspectionJsonObject

const mergeFields = (
    first: InspectionJsonObject,
    second?: Readonly<Record<string, InspectionJsonValue | undefined>>,
): InspectionJsonObject => {
    if (second === undefined) return first
    return Object.freeze({ ...first, ...sanitizeFields(second) })
}

const addFinite = (current: number, amount: number | undefined): number =>
    amount === undefined || !Number.isFinite(amount) || amount <= 0
        ? current
        : current + amount

const inspectThenable = (
    value: unknown,
):
    | Readonly<{ kind: "not-thenable" }>
    | Readonly<{
          kind: "thenable"
          target: object | ((...args: never[]) => unknown)
          then: (...args: unknown[]) => unknown
      }>
    | Readonly<{ kind: "inspection-error"; error: unknown }> => {
    if (
        (typeof value !== "object" || value === null) &&
        typeof value !== "function"
    ) {
        return NOT_THENABLE
    }
    try {
        const then = (value as { readonly then?: unknown }).then
        return typeof then === "function"
            ? {
                  kind: "thenable",
                  target: value,
                  then: then as (...args: unknown[]) => unknown,
              }
            : NOT_THENABLE
    } catch (error) {
        return { kind: "inspection-error", error }
    }
}

const NOT_THENABLE = Object.freeze({ kind: "not-thenable" as const })

class StructuralInspectionRecorder implements InternalInspectionRecorder {
    #summaryRing: BoundedRing<InspectionSummary>
    #detailRing: BoundedRing<InspectionDetail>
    readonly #summaryCapacity: number
    readonly #detailCapacity: number
    #recordingId = ""
    #nextSequence = 1
    #nextSpanId = 1
    #nextOperationId = 1
    #nextCommitId = 1
    #nextEvaluationId = 1
    #nextSearchId = 1
    #nextSessionId = 1
    #nextGenericId = 1
    #nextReferenceId = 1
    #active: ActiveInterval[] = []
    #referenceIds = new WeakMap<object, number>()
    #referenceNames = new WeakMap<object, string>()
    #storeScopes = new WeakMap<object, StoreScopeNode>()
    #sessionIds = new WeakMap<object, number>()
    #summaryOverflow = 0
    #detailOverflow = 0
    #fault: InspectionRecorderFault | undefined
    #clockOrigin: number
    readonly #instrumentation: InternalStoreTreeInstrumentation

    constructor(
        options: InspectableStoreOptions,
        instrumentation: InternalStoreTreeInstrumentation,
    ) {
        this.#instrumentation = instrumentation
        this.#summaryCapacity = readCapacity(
            options.capacity?.summaries,
            DEFAULT_SUMMARY_CAPACITY,
            "Inspection summary",
            false,
        )
        this.#detailCapacity = readCapacity(
            options.capacity?.details,
            DEFAULT_DETAIL_CAPACITY,
            "Inspection detail",
            true,
        )
        this.#summaryRing = new BoundedRing(this.#summaryCapacity)
        this.#detailRing = new BoundedRing(this.#detailCapacity)
        this.#clockOrigin = this.#clockNow()
        this.#startRecording()
    }

    get recordingId(): string {
        return this.#recordingId
    }

    registerStore(store: CommittedStoreTree, scope: StoreScopeNode): void {
        this.#storeScopes.set(store as object, scope)
    }

    capture<Value>(
        store: CommittedStoreTree,
        state?: State<Value>,
    ): InspectionCapture {
        const storeTarget =
            (typeof store === "object" && store !== null) ||
            typeof store === "function"
                ? (store as object)
                : undefined
        const scope =
            storeTarget === undefined
                ? undefined
                : this.#storeScopes.get(storeTarget)
        if (scope === undefined) {
            throw new TypeError(
                "Inspection capture requires a Store owned by this inspector",
            )
        }

        let stateReference: InspectionReference | undefined
        if (state !== undefined) {
            const stateTarget =
                (typeof state === "object" && state !== null) ||
                typeof state === "function"
                    ? (state as object)
                    : undefined
            const domain = scope.coordinator.runtimeDomain
            if (stateTarget === undefined || !domain.states.has(stateTarget)) {
                throw new TypeError("Inspection capture requires a valid State")
            }
            const atom = domain.atoms.get(stateTarget)
            const selector = domain.selectors.get(stateTarget)
            if (atom === undefined && selector === undefined) {
                throw new TypeError("Inspection capture requires a valid State")
            }
            const definitionName = atom?.name ?? selector?.name
            stateReference = this.reference(
                stateTarget,
                atom === undefined ? "selector" : "atom",
                typeof definitionName === "string" ? definitionName : undefined,
            )
        }

        const monotonicTimeMs = this.#clockNow()
        return Object.freeze({
            recordingId: this.#recordingId,
            timeUs: this.#timeUs(monotonicTimeMs),
            monotonicTimeMs,
            store: this.reference(scope, "scope", scope.name),
            ...(stateReference === undefined ? {} : { state: stateReference }),
            ...this.#activeLinks(),
        })
    }

    reference(
        target: object,
        kind: InspectionReferenceKind,
        name?: string,
    ): InspectionReference {
        if (this.#fault !== undefined) return UNKNOWN_REFERENCE
        try {
            let id = this.#referenceIds.get(target)
            if (id === undefined) {
                id = this.#nextReferenceId++
                this.#referenceIds.set(target, id)
            }
            let resolvedName = this.#referenceNames.get(target)
            if (resolvedName === undefined && name !== undefined) {
                resolvedName = normalizeLabel(name)
                this.#referenceNames.set(target, resolvedName)
            }
            const reference = Object.freeze({
                id,
                kind,
                ...(resolvedName === undefined ? {} : { name: resolvedName }),
            }) as InspectionReference
            return reference
        } catch {
            this.#recordFault("reference")
            return UNKNOWN_REFERENCE
        }
    }

    sessionId(session: object): number {
        const current = this.#sessionIds.get(session)
        if (current !== undefined) return current
        const id = this.#nextSessionId++
        this.#sessionIds.set(session, id)
        return id
    }

    beginInterval(
        input: InternalInspectionIntervalInput,
    ): InternalInspectionIntervalToken {
        if (this.#fault !== undefined) return DISABLED_INTERVAL
        try {
            const id = this.#allocateIntervalId(input.type)
            const token = Object.freeze({ id, type: input.type })
            const links = Object.freeze({
                ...this.#activeLinks(),
                ...input.links,
            })
            const frame: ActiveInterval = {
                token,
                parentId: this.#active[this.#active.length - 1]?.token.id,
                links,
                name:
                    input.name === undefined
                        ? undefined
                        : normalizeLabel(input.name),
                seqStart: this.#nextSequence++,
                startUs: this.#nowUs(),
                fields: sanitizeFields(input.fields),
                totals: SUMMARY_TYPES.has(input.type)
                    ? createMutableTotals()
                    : undefined,
                commitId: undefined,
                commitSourceApplied: false,
                commitChangedSources: undefined,
                commitOwnershipChanged: undefined,
                commitFailurePhase: undefined,
                operationIntents: 0,
                counterStart: SUMMARY_TYPES.has(input.type)
                    ? this.#captureCounters()
                    : undefined,
            }
            if (input.type === "commit") {
                const operation = this.#findActive("operation")
                if (operation !== undefined) operation.commitId = id
            }
            this.#active.push(frame)
            return token
        } catch {
            this.#recordFault("begin-interval")
            return DISABLED_INTERVAL
        }
    }

    finishInterval(
        token: InternalInspectionIntervalToken,
        finish: InternalInspectionIntervalFinish = {},
    ): void {
        if (token.id === 0 || this.#fault !== undefined) return
        try {
            const frame = this.#active.pop()
            if (frame === undefined || !Object.is(frame.token, token)) {
                throw new Error(
                    "Inspection intervals must finish in LIFO order",
                )
            }
            this.#addCounterDelta(frame)
            const seqEnd = this.#nextSequence++
            const durationUs = Math.max(0, this.#nowUs() - frame.startUs)
            const fields = mergeFields(frame.fields, finish.fields)
            const event = this.#buildIntervalEvent(
                frame,
                seqEnd,
                durationUs,
                fields,
                finish.result,
            )
            if (SUMMARY_TYPES.has(frame.token.type)) {
                if (this.#summaryRing.add(event as InspectionSummary)) {
                    this.#summaryOverflow++
                }
            } else if (this.#detailRing.add(event as InspectionDetail)) {
                this.#detailOverflow++
            }
        } catch {
            this.#recordFault("finish-interval")
        }
    }

    record(input: InternalInspectionDetailInput): void {
        if (this.#fault !== undefined) return
        try {
            const sequence = this.#nextSequence++
            const event = Object.freeze({
                ...sanitizeFields(input.fields),
                type: input.type,
                sequence,
                timeUs: this.#nowUs(),
                ...this.#activeLinks(),
                ...input.links,
            }) as InspectionDetail
            if (this.#detailRing.add(event)) this.#detailOverflow++
        } catch {
            this.#recordFault("record-detail")
        }
    }

    addWork(delta: InspectionWorkDelta): void {
        if (this.#fault !== undefined) return
        try {
            for (const frame of this.#active) {
                const totals = frame.totals
                if (totals === undefined) continue
                totals.selectorEvaluations = addFinite(
                    totals.selectorEvaluations,
                    delta.selectorEvaluations,
                )
                totals.proposedTopologyChanges = addFinite(
                    totals.proposedTopologyChanges,
                    delta.proposedTopologyChanges,
                )
                totals.proposedTopologyIdentical = addFinite(
                    totals.proposedTopologyIdentical,
                    delta.proposedTopologyIdentical,
                )
                totals.transientSelectorHostsCreated = addFinite(
                    totals.transientSelectorHostsCreated,
                    delta.transientSelectorHostsCreated,
                )
                totals.propagationSettled = addFinite(
                    totals.propagationSettled,
                    delta.propagationSettled,
                )
                totals.notificationTargets = addFinite(
                    totals.notificationTargets,
                    delta.notificationTargets,
                )
                totals.subscriberCallbacks = addFinite(
                    totals.subscriberCallbacks,
                    delta.subscriberCallbacks,
                )
                const cycle = delta.cycle
                if (cycle === undefined) continue
                totals.cycle.searches = addFinite(
                    totals.cycle.searches,
                    cycle.searches,
                )
                totals.cycle.visits = addFinite(
                    totals.cycle.visits,
                    cycle.visits,
                )
                totals.cycle.maxVisits = Math.max(
                    totals.cycle.maxVisits,
                    cycle.maxVisits ?? 0,
                )
                totals.cycle.found = addFinite(totals.cycle.found, cycle.found)
                if (cycle.site === "prefix-revalidation") {
                    totals.cycle.prefixRevalidation += cycle.searches ?? 1
                } else if (cycle.site === "new-edge-proof") {
                    totals.cycle.newEdgeProof += cycle.searches ?? 1
                }
                if (cycle.host !== undefined) {
                    totals.cycle[cycle.host] += cycle.searches ?? 1
                }
                if (cycle.host !== undefined && cycle.site !== undefined) {
                    const site =
                        cycle.site === "prefix-revalidation"
                            ? "prefixRevalidation"
                            : "newEdgeProof"
                    const lane = totals.cycle.lanes[cycle.host][site]
                    lane.searches = addFinite(lane.searches, cycle.searches)
                    lane.visits = addFinite(lane.visits, cycle.visits)
                    lane.maxVisits = Math.max(
                        lane.maxVisits,
                        cycle.maxVisits ?? 0,
                    )
                    lane.found = addFinite(lane.found, cycle.found)
                }
            }
        } catch {
            this.#recordFault("add-work")
        }
    }

    beginStoreOperation(input: {
        readonly operation: "set" | "update" | "reset" | "transaction"
        readonly scope: object
        readonly scopeName?: string
        readonly name?: string
    }): InternalInspectionIntervalToken {
        return this.beginInterval({
            type: "operation",
            ...(input.name === undefined ? {} : { name: input.name }),
            fields: {
                operation: input.operation,
                scope: this.reference(input.scope, "scope", input.scopeName),
            },
        })
    }

    finishStoreOperation(
        token: InternalInspectionIntervalToken,
        result: "returned" | "threw",
    ): void {
        const operation = this.#findActive("operation")
        const effect =
            operation === undefined ||
            !Object.is(operation.token, token) ||
            operation.commitId === undefined ||
            !operation.commitSourceApplied
                ? "none"
                : result === "returned"
                  ? "committed"
                  : operation.commitFailurePhase === "notify"
                    ? "committed-with-notification-error"
                    : "committed-with-propagation-error"
        this.finishInterval(token, { result, fields: { effect } })
    }

    beginStoreCommit(
        operation: InternalInspectionIntervalToken,
    ): InternalInspectionIntervalToken {
        return this.beginInterval({
            type: "commit",
            links: { operationId: operation.id },
        })
    }

    finishStoreCommit(
        token: InternalInspectionIntervalToken,
        input: {
            readonly result: "returned" | "threw"
            readonly intents: number
            readonly changedSources?: number
            readonly ownershipChanged?: boolean
            readonly sourceApplied: boolean
            readonly notificationsCompleted: boolean
            readonly failurePhase?: "propagate" | "notify"
        },
    ): void {
        const operation = this.#findActive("operation")
        if (operation !== undefined) {
            operation.commitSourceApplied ||= input.sourceApplied
            operation.commitFailurePhase = input.failurePhase
        }
        this.finishInterval(token, {
            result: input.result,
            fields: {
                intents: input.intents,
                ...(input.changedSources === undefined
                    ? {}
                    : { changedSources: input.changedSources }),
                ...(input.ownershipChanged === undefined
                    ? {}
                    : { ownershipChanged: input.ownershipChanged }),
                sourceApplied: input.sourceApplied,
                notificationsCompleted: input.notificationsCompleted,
            },
        })
    }

    recordStoreIntent(input: {
        readonly scope: object
        readonly scopeName?: string
        readonly atom: object
        readonly atomName?: string
        readonly intent: "set" | "reset"
    }): void {
        this.record({
            type: "intent",
            fields: {
                intent: input.intent,
                scope: this.reference(input.scope, "scope", input.scopeName),
                atom: this.reference(input.atom, "atom", input.atomName),
            },
        })
    }

    recordStoreEvent(...event: StoreRecorderEvent): void {
        const code = event[0]
        if (code === 0) {
            const operation = (
                ["set", "update", "reset", "transaction"] as const
            )[event[1]]
            this.beginStoreOperation({
                operation,
                scope: event[2],
                ...(event[3] === undefined ? {} : { scopeName: event[3] }),
                ...(event[4] === undefined ? {} : { name: event[4] }),
            })
            return
        }
        if (code === 1) {
            const result = event[1] === 0 ? "returned" : "threw"
            const operation = this.#findActive("operation")
            if (operation === undefined) return
            const commit = this.#findActive("commit")
            if (commit !== undefined) {
                this.#addCounterDelta(commit)
                this.finishStoreCommit(commit.token, {
                    result,
                    intents: operation.operationIntents,
                    ...(commit.commitChangedSources === undefined
                        ? {}
                        : { changedSources: commit.commitChangedSources }),
                    ...(commit.commitOwnershipChanged === undefined
                        ? {}
                        : {
                              ownershipChanged: commit.commitOwnershipChanged,
                          }),
                    sourceApplied: commit.commitSourceApplied,
                    notificationsCompleted: result === "returned",
                    ...(event[2] === undefined
                        ? {}
                        : {
                              failurePhase:
                                  event[2] === 1 ? "notify" : "propagate",
                          }),
                })
            }
            this.finishStoreOperation(operation.token, result)
            return
        }
        if (code === 2) {
            const operation = this.#findActive("operation")
            if (operation !== undefined) this.beginStoreCommit(operation.token)
            return
        }
        if (code === 3) {
            const commit = this.#findActive("commit")
            if (commit !== undefined) {
                commit.commitSourceApplied = true
                commit.commitChangedSources = event[1]
            }
            return
        }
        const operation = this.#findActive("operation")
        if (operation !== undefined) operation.operationIntents++
        this.recordStoreIntent({
            intent: event[1] === 0 ? "set" : "reset",
            scope: event[2],
            ...(event[3] === undefined ? {} : { scopeName: event[3] }),
            atom: event[4],
            ...(event[5] === undefined ? {} : { atomName: event[5] }),
        })
    }

    hasActiveStoreOperation(): boolean {
        return this.#findActive("operation") !== undefined
    }

    beginDraftCommit(
        draft: TreeDraft,
        atomDefinitions: WeakMap<object, Readonly<{ name?: unknown }>>,
    ): void {
        this.recordStoreEvent(2)
        draft.forEachIntent((scope, intent) => {
            const name = atomDefinitions.get(intent.atom)?.name
            this.recordStoreEvent(
                5,
                intent.kind === "set" ? 0 : 2,
                scope,
                scope.name,
                intent.atom,
                typeof name === "string" ? name : undefined,
            )
        })
    }

    findDependencyPath<Node, Token extends object>(
        hostKind: "committed" | "scratch" | "hydration",
        hostRef: InspectionReference,
        start: Node,
        target: Node,
        host: SelectorEvaluationHost<Node, Token>,
        session: SelectorEvaluationSession<Node>,
        site: SelectorCycleSearchSite,
        evaluationGraphVersionStart: number,
        evaluationAttributedPublicationStart: number,
        parentWasCold: boolean,
    ): readonly Node[] | undefined {
        const siteName = site === 0 ? "prefix-revalidation" : "new-edge-proof"
        const interval = this.beginInterval({
            type: "cycle-search",
            fields: {
                site: siteName,
                host: hostKind,
                hostRef,
                start: this.#stateReference(start),
                target: this.#stateReference(target),
                graphVersion: host.getSelectorGraphVersion(),
                attributedSessionPublications:
                    session.getSelectorGraphPublicationCount(host),
                evaluationGraphVersionDelta:
                    host.getSelectorGraphVersion() -
                    evaluationGraphVersionStart,
                evaluationAttributedPublicationDelta:
                    session.getSelectorGraphPublicationCount(host) -
                    evaluationAttributedPublicationStart,
                acceptedPrefixLength:
                    session.getTransientDependencies(host, target)?.length ?? 0,
                parentWasCold,
            },
        })
        const pending = [start]
        const parent = new Map<Node, Node | typeof DEPENDENCY_PATH_ROOT>([
            [start, DEPENDENCY_PATH_ROOT],
        ])
        let visits = 0
        let edges = 0
        let maxFrontier = 1
        let transientExpansions = 0
        let recordExpansions = 0
        let terminalPrunes = 0
        let path: readonly Node[] | undefined

        while (pending.length > 0) {
            const node = pending.pop() as Node
            visits++
            if (Object.is(node, target)) {
                const reversed: Node[] = []
                let cursor: Node | typeof DEPENDENCY_PATH_ROOT = node
                while (cursor !== DEPENDENCY_PATH_ROOT) {
                    reversed.push(cursor)
                    cursor = parent.get(cursor) as
                        | Node
                        | typeof DEPENDENCY_PATH_ROOT
                }
                reversed.reverse()
                path = Object.freeze(reversed)
                break
            }

            const transient = session.getTransientDependencies(host, node)
            if (transient) {
                transientExpansions++
                edges += transient.length
                for (const dependency of transient) {
                    if (parent.has(dependency.node)) continue
                    parent.set(dependency.node, node)
                    pending.push(dependency.node)
                }
                if (pending.length > maxFrontier) maxFrontier = pending.length
                continue
            }

            if (host.getSelectorDependencyNodes !== undefined) {
                const dependencies = host.getSelectorDependencyNodes(node)
                if (dependencies === undefined) {
                    terminalPrunes++
                    continue
                }
                recordExpansions++
                edges += dependencies.length
                for (const dependency of dependencies) {
                    if (parent.has(dependency)) continue
                    parent.set(dependency, node)
                    pending.push(dependency)
                }
                if (pending.length > maxFrontier) maxFrontier = pending.length
                continue
            }

            const record = host.getSelectorRecord(node)
            if (!record) {
                terminalPrunes++
                continue
            }
            recordExpansions++
            edges += record.dependencies.length
            for (const dependency of record.dependencies) {
                if (parent.has(dependency.node)) continue
                parent.set(dependency.node, node)
                pending.push(dependency.node)
            }
            if (pending.length > maxFrontier) maxFrontier = pending.length
        }

        this.addWork({
            cycle: {
                searches: 1,
                visits,
                maxVisits: visits,
                found: path === undefined ? 0 : 1,
                site: siteName,
                host: hostKind,
            },
        })
        this.finishInterval(interval, {
            result: "returned",
            fields: {
                visits,
                edges,
                maxFrontier,
                transientExpansions,
                recordExpansions,
                terminalPrunes,
                found: path !== undefined,
                ...(path === undefined
                    ? {}
                    : {
                          path: path.map(node => this.#stateReference(node)),
                      }),
            },
        })
        return path
    }

    span<Result>(name: string, callback: () => Result): Result {
        if (typeof name !== "string") {
            throw new TypeError("Inspection span name must be a string")
        }
        if (typeof callback !== "function") {
            throw new TypeError("Inspection span callback must be a function")
        }
        const token = this.beginInterval({ type: "span", name })
        let result: Result
        try {
            result = callback()
        } catch (error) {
            this.finishInterval(token, { result: "threw" })
            throw error
        }

        const inspected = inspectThenable(result)
        if (inspected.kind === "inspection-error") {
            this.finishInterval(token, { result: "threw" })
            throw inspected.error
        }
        if (inspected.kind === "thenable") {
            try {
                Reflect.apply(inspected.then, inspected.target, [
                    undefined,
                    NOOP,
                ])
            } catch {
                // The public synchronous boundary owns the named failure below.
            }
            this.finishInterval(token, { result: "async-rejected" })
            throw new TypeError("Inspection spans must be synchronous")
        }
        this.finishInterval(token, { result: "returned" })
        return result
    }

    export(): InspectionExport {
        this.#assertIdle("export")
        const summaries = [...this.#summaryRing.snapshot()].sort(
            (left, right) => left.seqStart - right.seqStart,
        )
        const details = [...this.#detailRing.snapshot()].sort(
            (left, right) =>
                (left.seqStart ?? left.sequence ?? 0) -
                (right.seqStart ?? right.sequence ?? 0),
        )
        const summaryBounds = retainedBounds(summaries)
        const detailBounds = retainedBounds(details)
        return Object.freeze({
            schema: "valdres.inspect" as const,
            schemaVersion: 1 as const,
            recordingId: this.#recordingId,
            summaries: Object.freeze(summaries),
            details: Object.freeze(details),
            complete:
                this.#summaryOverflow === 0 &&
                this.#detailOverflow === 0 &&
                this.#fault === undefined,
            overflow: Object.freeze({
                summaries: this.#summaryOverflow,
                details: this.#detailOverflow,
                retained: Object.freeze({
                    ...(summaryBounds === undefined
                        ? {}
                        : { summaries: summaryBounds }),
                    ...(detailBounds === undefined
                        ? {}
                        : { details: detailBounds }),
                }),
            }),
            ...(this.#fault === undefined ? {} : { fault: this.#fault }),
        })
    }

    reset(): void {
        this.#assertIdle("reset")
        this.#startRecording()
    }

    createInspector(): StoreInspector {
        const recorder = this
        return Object.freeze({
            get recordingId(): string {
                return recorder.recordingId
            },
            capture: <Value>(
                store: CommittedStoreTree,
                state?: State<Value>,
            ): InspectionCapture => recorder.capture(store, state),
            span: <Result>(name: string, callback: () => Result): Result =>
                recorder.span(name, callback),
            export: (): InspectionExport => recorder.export(),
            reset: (): void => recorder.reset(),
        }) as StoreInspector
    }

    #startRecording(): void {
        this.#recordingId = `inspection-${nextRecordingId++}`
        this.#summaryRing = new BoundedRing(this.#summaryCapacity)
        this.#detailRing = new BoundedRing(this.#detailCapacity)
        this.#nextSequence = 1
        this.#nextSpanId = 1
        this.#nextOperationId = 1
        this.#nextCommitId = 1
        this.#nextEvaluationId = 1
        this.#nextSearchId = 1
        this.#nextSessionId = 1
        this.#nextGenericId = 1
        this.#nextReferenceId = 1
        this.#active = []
        this.#referenceIds = new WeakMap()
        this.#sessionIds = new WeakMap()
        this.#summaryOverflow = 0
        this.#detailOverflow = 0
        this.#fault = undefined
        this.#clockOrigin = this.#clockNow()
    }

    #allocateIntervalId(type: InternalInspectionIntervalType): number {
        if (type === "span") return this.#nextSpanId++
        if (type === "operation") return this.#nextOperationId++
        if (type === "commit") return this.#nextCommitId++
        if (type === "selector-evaluation") return this.#nextEvaluationId++
        if (type === "cycle-search") return this.#nextSearchId++
        return this.#nextGenericId++
    }

    #activeLinks(): InternalInspectionLinks {
        const links: {
            spanId?: number
            operationId?: number
            commitId?: number
            sessionId?: number
            evaluationId?: number
            searchId?: number
        } = {}
        for (const frame of this.#active) {
            const { id, type } = frame.token
            if (frame.links.sessionId !== undefined) {
                links.sessionId = frame.links.sessionId
            }
            if (type === "span") links.spanId = id
            else if (type === "operation") links.operationId = id
            else if (type === "commit") links.commitId = id
            else if (type === "selector-evaluation") links.evaluationId = id
            else if (type === "cycle-search") links.searchId = id
        }
        return links
    }

    #findActive(
        type: InternalInspectionIntervalType,
    ): ActiveInterval | undefined {
        for (let index = this.#active.length - 1; index >= 0; index--) {
            const frame = this.#active[index]!
            if (frame.token.type === type) return frame
        }
        return undefined
    }

    #stateReference<Node>(node: Node): InspectionJsonValue {
        return (typeof node === "object" && node !== null) ||
            typeof node === "function"
            ? this.reference(node as object, "state")
            : sanitizeJson(node, { remaining: 1 }, new Set(), 0)
    }

    #buildIntervalEvent(
        frame: ActiveInterval,
        seqEnd: number,
        durationUs: number,
        fields: InspectionJsonObject,
        result: InternalInspectionIntervalFinish["result"],
    ): InspectionSummary | InspectionDetail {
        const common = {
            ...fields,
            type: frame.token.type,
            seqStart: frame.seqStart,
            seqEnd,
            startUs: frame.startUs,
            durationUs,
            ...frame.links,
        }
        if (frame.token.type === "span") {
            return Object.freeze({
                ...common,
                type: "span" as const,
                spanId: frame.token.id,
                ...(frame.links.spanId === undefined
                    ? {}
                    : { parentSpanId: frame.links.spanId }),
                name: frame.name ?? "",
                result: result ?? "returned",
                totals: freezeTotals(frame.totals as MutableWorkTotals),
            }) as SpanInspection
        }
        if (frame.token.type === "operation") {
            return Object.freeze({
                ...common,
                type: "operation" as const,
                operationId: frame.token.id,
                ...(frame.name === undefined ? {} : { name: frame.name }),
                ...(frame.commitId === undefined
                    ? {}
                    : { commitId: frame.commitId }),
                result:
                    result === "threw" || result === "async-rejected"
                        ? "threw"
                        : "returned",
                effect:
                    fields.effect ??
                    (frame.commitId === undefined ? "none" : "committed"),
                totals: freezeTotals(frame.totals as MutableWorkTotals),
            }) as OperationInspection
        }
        if (frame.token.type === "commit") {
            return Object.freeze({
                ...common,
                type: "commit" as const,
                commitId: frame.token.id,
                operationId: frame.links.operationId ?? 0,
                intents: fields.intents ?? 0,
                changedSources: fields.changedSources ?? 0,
                ownershipChanged: fields.ownershipChanged ?? false,
                sourceApplied: fields.sourceApplied ?? true,
                notificationsCompleted: fields.notificationsCompleted ?? true,
                totals: freezeTotals(frame.totals as MutableWorkTotals),
            }) as CommitInspection
        }

        const identity =
            frame.token.type === "selector-evaluation"
                ? { evaluationId: frame.token.id }
                : frame.token.type === "cycle-search"
                  ? { searchId: frame.token.id }
                  : { id: frame.token.id }
        return Object.freeze({
            ...common,
            ...identity,
        }) as InspectionDetail
    }

    #assertIdle(operation: string): void {
        if (this.#active.length !== 0) {
            throw new Error(`Inspection ${operation} requires an idle Store`)
        }
    }

    #captureCounters(): CounterSnapshot {
        const read = (counter: StoreTreeCounter): number =>
            this.#instrumentation.read(counter)
        return {
            sourceEpoch: read("sourceEpoch"),
            transientSelectorHostsCreated: read("scratchHostAllocations"),
            propagationSettled: read("propagationSettlements"),
            notificationTargets: read("notificationTargetsReached"),
            subscriberCallbacks: read("subscriberCallbacksAttempted"),
        }
    }

    #addCounterDelta(frame: ActiveInterval): void {
        const start = frame.counterStart
        if (start === undefined) return
        frame.counterStart = undefined
        const end = this.#captureCounters()
        if (frame.token.type === "commit") {
            frame.commitOwnershipChanged = end.sourceEpoch !== start.sourceEpoch
        }
        const totals = frame.totals
        if (totals === undefined) return
        totals.transientSelectorHostsCreated +=
            end.transientSelectorHostsCreated -
            start.transientSelectorHostsCreated
        totals.propagationSettled +=
            end.propagationSettled - start.propagationSettled
        totals.notificationTargets +=
            end.notificationTargets - start.notificationTargets
        totals.subscriberCallbacks +=
            end.subscriberCallbacks - start.subscriberCallbacks
    }

    #recordFault(phase: string): void {
        if (this.#fault !== undefined) return
        const sequence = this.#nextSequence++
        this.#fault = Object.freeze({
            type: "recorder-fault",
            phase,
            sequence,
        })
        this.#active = []
    }

    #clockNow(): number {
        return globalThis.performance?.now() ?? Date.now()
    }

    #timeUs(monotonicTimeMs: number): number {
        return Math.max(
            0,
            Math.round((monotonicTimeMs - this.#clockOrigin) * 1_000),
        )
    }

    #nowUs(): number {
        return this.#timeUs(this.#clockNow())
    }
}

const UNKNOWN_REFERENCE = Object.freeze({
    id: 0,
    kind: "store" as const,
}) as InspectionReference

const DISABLED_INTERVAL = Object.freeze({
    id: 0,
    type: "operation" as const,
})

type MutableStoreOperations = {
    -readonly [Key in
        | "set"
        | "update"
        | "reset"
        | "txn"]: CommittedStoreTree[Key]
}

const createStoreTrace = (
    recorder: StructuralInspectionRecorder,
): InternalStoreTreeTrace => {
    const run = <Result>(
        operation: 0 | 1 | 2 | 3,
        scope: StoreScopeNode,
        name: string | undefined,
        callback: () => Result,
    ): Result => {
        if (recorder.hasActiveStoreOperation()) return callback()
        recorder.recordStoreEvent(0, operation, scope, scope.name, name)
        try {
            const result = callback()
            recorder.recordStoreEvent(1, 0)
            return result
        } catch (error) {
            recorder.recordStoreEvent(
                1,
                1,
                error instanceof SubscriberNotificationError ? 1 : 0,
            )
            throw error
        }
    }

    const trace = ((code: number, first?: unknown, second?: unknown): void => {
        if (code === 0) {
            const store = first as CommittedStoreTree
            const scope = second as StoreScopeNode
            recorder.registerStore(store, scope)
            const mutable = store as MutableStoreOperations
            const set = store.set
            const update = store.update
            const reset = store.reset
            const txn = store.txn
            mutable.set = (atom, value) =>
                run(0, scope, undefined, () => set(atom, value))
            mutable.update = (atom, updater) =>
                run(1, scope, undefined, () => update(atom, updater))
            mutable.reset = atom => run(2, scope, undefined, () => reset(atom))
            mutable.txn = <Result>(
                callback: TransactionCallback<Result>,
                name?: string,
            ): Result => {
                if (
                    typeof callback !== "function" ||
                    (name !== undefined && typeof name !== "string")
                ) {
                    return txn(callback, name)
                }
                return run(3, scope, name, () => txn(callback, name))
            }
            return
        }
        if (code === 1) {
            recorder.beginDraftCommit(
                first as TreeDraft,
                second as WeakMap<object, Readonly<{ name?: unknown }>>,
            )
            return
        }
        if (code === 2) {
            recorder.recordStoreEvent(3, first as number)
        }
    }) as InternalStoreTreeTrace

    const evaluate: SelectorEvaluationStrategy = <
        Node,
        Token extends object,
        Value,
    >(
        definition: SelectorDefinition<Node, Value>,
        host: SelectorEvaluationHost<Node, Token>,
        session: SelectorEvaluationSession<Node>,
    ): SelectorEvaluationProposal<Node, Token, Value> => {
        const hostKind =
            host.getSelectorDependencyNodes !== undefined
                ? "committed"
                : recorder.hasActiveStoreOperation()
                  ? "scratch"
                  : "hydration"
        const hostName = (host as { readonly name?: unknown }).name
        const hostRef = recorder.reference(
            host as object,
            hostKind === "committed" ? "scope" : "scratch-host",
            typeof hostName === "string" ? hostName : undefined,
        )
        const graphVersionStart = host.getSelectorGraphVersion()
        const attributedPublicationStart =
            session.getSelectorGraphPublicationCount(host)
        const previousDependencies = host.getSelectorRecord(
            definition.node,
        )?.dependencies
        const previousDependencyCount = previousDependencies?.length ?? 0
        const interval = recorder.beginInterval({
            type: "selector-evaluation",
            links: { sessionId: recorder.sessionId(session) },
            fields: {
                host: hostKind,
                hostRef,
                selector: recorder.reference(
                    definition.node as object,
                    "selector",
                    typeof definition.name === "string"
                        ? definition.name
                        : undefined,
                ),
                graphVersionStart,
                previousDependencyCount,
            },
        })
        recorder.addWork({ selectorEvaluations: 1 })
        const cycleSearch: SelectorCycleSearch<Node, Token> = (
            start,
            target,
            cycleHost,
            cycleSession,
            site,
        ) =>
            recorder.findDependencyPath(
                hostKind,
                hostRef,
                start,
                target,
                cycleHost,
                cycleSession,
                site,
                graphVersionStart,
                attributedPublicationStart,
                previousDependencies === undefined,
            )
        try {
            const proposal = evaluateSelector(
                definition,
                host,
                session,
                cycleSearch,
            )
            const proposedTopologyChanged =
                previousDependencies === undefined ||
                previousDependencies.length !== proposal.dependencies.length ||
                previousDependencies.some(
                    (dependency, index) =>
                        !Object.is(
                            dependency.node,
                            proposal.dependencies[index]?.node,
                        ),
                )
            const previousNodes = new Set(
                previousDependencies?.map(dependency => dependency.node),
            )
            const nextNodes = new Set(
                proposal.dependencies.map(dependency => dependency.node),
            )
            let proposedEdgesAdded = 0
            let proposedEdgesRemoved = 0
            for (const node of nextNodes) {
                if (!previousNodes.has(node)) proposedEdgesAdded++
            }
            for (const node of previousNodes) {
                if (!nextNodes.has(node)) proposedEdgesRemoved++
            }
            recorder.addWork(
                proposedTopologyChanged
                    ? { proposedTopologyChanges: 1 }
                    : { proposedTopologyIdentical: 1 },
            )
            recorder.finishInterval(interval, {
                result: "returned",
                fields: {
                    outcome: proposal.outcome.kind,
                    dependencyCount: proposal.dependencies.length,
                    proposedTopologyChanged,
                    proposedEdgesAdded,
                    proposedEdgesRemoved,
                    graphVersionEnd: host.getSelectorGraphVersion(),
                },
            })
            return proposal
        } catch (error) {
            recorder.finishInterval(interval, {
                result: "threw",
                fields: {
                    outcome: "threw",
                    graphVersionEnd: host.getSelectorGraphVersion(),
                },
            })
            throw error
        }
    }
    Object.assign(trace, {
        evaluate,
    })
    return Object.freeze(trace)
}

export const createInspectionRecorder = (
    options: InspectableStoreOptions = {},
): InternalInspectionSetup => {
    const instrumentation = createInternalStoreTreeInstrumentation()
    const recorder = new StructuralInspectionRecorder(options, instrumentation)
    return Object.freeze({
        recorder,
        inspect: recorder.createInspector(),
        instrumentation,
        trace: createStoreTrace(recorder),
    })
}
