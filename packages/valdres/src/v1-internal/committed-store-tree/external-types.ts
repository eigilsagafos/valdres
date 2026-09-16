import type {
    SelectorEvaluationSession,
    ServedSelectorOutcome,
} from "../selector-evaluator/types"
import type { AnyState, RuntimeDomainRecords } from "./runtime-domain"
import type {
    StoreScopeNode,
    OutcomeToken,
    StoreTreeCounter,
} from "./scope-node"

export interface ExternalBounds {
    rounds: number
    samples: number
    deliveryDepth: number
    deliveryWork: number
}
export type ExternalOperationPhase =
    | "materializingRead"
    | "drafting"
    | "preflight"
    | "applying"
    | "propagating"
    | "transitioningLifecycle"
    | "instrumenting"
    | "notifying"
    | "samplingExternal"
    | "drainingExternal"
    | "disposing"
    | "cleanup"
    | "terminal"

/** A tree-owned optional plane. Every settlement still uses the core queue. */
export interface ExternalTreeBindings {
    readonly domain: RuntimeDomainRecords
    readonly propagating: () => boolean
    readonly subscriberRead: () => boolean
    readonly subscribed: (scope: StoreScopeNode, node: AnyState) => boolean
    readonly token: () => OutcomeToken
    readonly count: (counter: StoreTreeCounter, amount?: number) => void
    readonly advanceEpoch: () => void
    readonly epoch: () => number
    readonly reach: (scope: StoreScopeNode, node: AnyState) => void
    readonly settleRead: (prepare: () => void) => void
}

export interface ExternalTreePlane {
    readonly operating: boolean
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
    failure(cause: unknown, phase?: ExternalOperationFailure["phase"]): void
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
    createTree(bindings: ExternalTreeBindings): ExternalTreePlane
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
