import type { StoreTreeCounterId } from "./counter-ids"
import type { TreeDraft } from "./tree-transaction"
import type { SynchronousResult } from "./runtime-domain"
import type { SubscriptionRegistration } from "./committed-store-tree"
import type {
    SelectorEvaluationSession,
    ServedSelectorOutcome,
} from "../selector-evaluator/types"
import type { AnyState, RuntimeDomainRecords } from "./runtime-domain"
import type {
    StoreScopeNode,
    SelectorRecord,
    OutcomeToken,
    StoreScopeEvaluationStrategy,
} from "./scope-node"

export interface ExternalBounds {
    rounds: number
    samples: number
    deliveryDepth: number
    deliveryWork: number
}
export const enum ExternalOperationPhase {
    materializingRead,
    drafting,
    preflight,
    applying,
    propagating,
    transitioningLifecycle,
    instrumenting,
    notifying,
    samplingExternal,
    drainingExternal,
    disposing,
    cleanup,
    terminal,
}

export interface ExternalTreeHost {
    readonly evaluate: StoreScopeEvaluationStrategy
    readonly runtimeDomain: RuntimeDomainRecords
    readonly postSourceApply: boolean
    readonly subscriberReading: boolean
    sourceEpoch: number
    createOutcomeToken(): OutcomeToken
    recordCounter(counter: StoreTreeCounterId, amount?: number): void
    hasSubscription(scope: StoreScopeNode, node: AnyState): boolean
    reachSubscriptionTarget(scope: StoreScopeNode, node: AnyState): void
    beginNotificationSettlement(): void
    clearNotificationSettlement(): void
    propagateFromSources(
        firstSource: undefined,
        remainingSources: undefined,
        prepare: () => void,
    ): void
}

/** A tree-owned optional plane. Every settlement still uses the core queue. */
export interface ExternalTreeBindings {
    readonly event: StoreScopeEvaluationStrategy["recordExtension"]
    readonly domain: RuntimeDomainRecords
    readonly propagating: () => boolean
    readonly subscriberRead: () => boolean
    readonly subscribed: (scope: StoreScopeNode, node: AnyState) => boolean
    readonly token: () => OutcomeToken
    readonly count: (counter: StoreTreeCounterId, amount?: number) => void
    readonly advanceEpoch: () => void
    readonly epoch: () => number
    readonly reach: (scope: StoreScopeNode, node: AnyState) => void
    readonly settleRead: (prepare: () => void) => void
}

export interface ExternalTreePlane {
    selectorRecord(
        scope: StoreScopeNode,
        record: SelectorRecord,
        session: SelectorEvaluationSession<AnyState>,
    ): SelectorRecord
    publishedSelector(
        scope: StoreScopeNode,
        node: AnyState,
        previous: SelectorRecord | undefined,
        record: SelectorRecord,
    ): void
    get(
        scope: StoreScopeNode,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken>
    observe(
        scope: StoreScopeNode,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken>
    subscribe(
        operation: (
            admitted: (registration: SubscriptionRegistration) => void,
        ) => () => void,
    ): () => void
    admit(
        registration: SubscriptionRegistration,
        token: OutcomeToken,
        admitted?: (registration: SubscriptionRegistration) => void,
    ): void
    notificationCallback(
        registration: SubscriptionRegistration,
    ): (() => unknown) | undefined
    notificationFailure(
        error: import("./runtime-domain").SubscriberNotificationError,
    ): unknown
    readonly operating: boolean
    readonly idle: boolean
    readonly admissionAllowed: boolean
    readonly pendingLifecycle: boolean
    active(node: AnyState): boolean
    installed(node: AnyState): ServedSelectorOutcome<OutcomeToken> | undefined
    current(scope: StoreScopeNode, node: AnyState): boolean
    run<Result>(
        source: ExternalOperationFailure["source"],
        operation: () => Result,
        rollback?: () => void,
    ): Result
    phase(phase: ExternalOperationPhase): void
    failure(
        cause: unknown,
        phase?: ExternalOperationFailure["phase"],
        origin?: object,
    ): void
    settleLifecycle(): boolean
    startup(): void
    readonly dormantPull: boolean
    readonly changedPull: boolean
    retainRoot(scope: StoreScopeNode, node: AnyState): void
    releaseRoot(scope: StoreScopeNode, node: AnyState): void
    reconcile(scope: StoreScopeNode, node: AnyState): void
    read(
        scope: StoreScopeNode,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken>
    serve(
        scope: StoreScopeNode,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken>
    refresh(
        scope: StoreScopeNode,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): void
    beginPropagation(): unknown
    endPropagation(previous: unknown): void
    recordSelectorFault(
        scope: StoreScopeNode,
        node: AnyState,
        error: unknown,
    ): void
    rethrowSelectorFault(
        scope: StoreScopeNode,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): void
}

export interface ExternalRuntime {
    readonly bounds: ExternalBounds
    createTree(host: ExternalTreeHost): ExternalTreePlane
    read(
        draft: TreeDraft,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
        serverPath?: readonly AnyState[],
        count?: (counter: StoreTreeCounterId, amount: number) => void,
    ): SynchronousResult
    fail(
        failures: readonly ExternalOperationFailure[],
        preserveMetadata?: boolean,
    ): never
}

export interface ExternalOperationFailure {
    readonly cause: unknown
    readonly committed: boolean
    readonly phase:
        | "admitting"
        | "sampling"
        | "settling"
        | "notifying"
        | "cleanup"
        | "instrumenting"
    readonly source:
        | "owned-mutation"
        | "external-read"
        | "external-startup"
        | "external-invalidation"
        | "external-drain"
        | "external-cleanup"
}
