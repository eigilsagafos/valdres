import { ExternalInspectionEvent } from "./external-inspection-protocol"
import {
    ExternalOperationPhase,
    HostOperationKind,
    HostOperationCursor,
} from "./external-types"
import { StoreTreeCounterId } from "./counter-ids"
import type { SubscriptionRegistration } from "./committed-store-tree"
import {
    SelectorEvaluationSession,
    type ServedSelectorOutcome,
} from "../selector-evaluator/types"
import {
    rejectCallbackOperation,
    SubscriberNotificationError,
    containThenable,
    sameOutcome,
    inspectThenable,
    type AnyState,
} from "./runtime-domain"
import {
    WeakHandleSet,
    type OutcomeToken,
    type StoreScopeNode,
    type SelectorRecord,
} from "./scope-node"
import {
    DormantExternalReadError,
    ExternalSourceNonConvergenceError,
    ExternalSourceDeliveryLimitError,
    InvalidExternalCleanupError,
    runExternalCallback,
    sampleExternal,
} from "./external-atom"
import type {
    ExternalBounds,
    ExternalOperationFailure,
    ExternalTreeBindings,
    ExternalTreeHost,
    ExternalTreePlane,
} from "./external-types"
interface Generation {
    owner: ExternalProjectionPlane | undefined
    projection: Projection | undefined
    cleanup: (() => unknown) | undefined
    retryRequired?: boolean
}
// Transport an already-recorded failed read to its operation boundary without
// creating a second ledger occurrence or comparing application error identities.
const recordedExternalFailure = Symbol()
// A departed callback retains only this cleared ticket, never its old tree.
const invalidator = (generation: Generation) => () =>
    generation.owner?.invalidate(generation)
interface Operation {
    source: ExternalOperationFailure["source"]
    readonly initialSource: ExternalOperationFailure["source"]
    registration?: SubscriptionRegistration
    phase: ExternalOperationPhase
    readonly epoch: number
    readonly failures: ExternalOperationFailure[]
    readonly internal: boolean[]
    readonly originals: unknown[]
    readonly controlOrigins: Set<object>
    terminal: boolean
    attachments: number
}

interface Projection {
    readonly node: AnyState
    served: ServedSelectorOutcome<OutcomeToken>
    readonly scopes: WeakHandleSet<StoreScopeNode>
    retains: number
    status: "dormant" | "attaching" | "active" | "detaching"
    generation?: Generation
}
interface RetainRecord {
    count: number
    root: boolean
    dependencies: Set<AnyState>
}
interface Pull {
    readonly samples: Map<AnyState, ServedSelectorOutcome<OutcomeToken>>
    readonly refreshed: WeakMap<StoreScopeNode, WeakSet<AnyState>>
    readonly dormant: boolean
    epochAdvanced: boolean
    faults?: Map<AnyState, unknown>
    selectorFaults?: WeakMap<StoreScopeNode, Map<AnyState, unknown>>
}

/** Owned exclusively by one CommittedStoreTreeHost. No evaluator or queue;
 * its bindings seed and drain the host's existing propagation machinery. */
export class ExternalProjectionPlane implements ExternalTreePlane {
    readonly #bindings: ExternalTreeBindings
    readonly #projections = new WeakMap<AnyState, Projection>()
    readonly #retains = new WeakMap<
        StoreScopeNode,
        WeakMap<AnyState, RetainRecord>
    >()
    #pull: Pull | undefined
    #operation: Operation | undefined
    readonly #attachments = new Set<Projection>()
    readonly #releases = new Set<Projection>()
    readonly #unattached = new Set<Projection>()
    readonly #dirty = new Set<Generation>()
    readonly #delivery: { depth: number; work: number }
    readonly #bounds: ExternalBounds

    constructor(
        host: ExternalTreeHost,
        delivery: { depth: number; work: number },
        bounds: ExternalBounds,
    ) {
        this.#bindings = {
            event: host.evaluate.recordExtension,
            domain: host.runtimeDomain,
            propagating: () => host.postSourceApply,
            subscriberRead: () => host.subscriberReading,
            subscribed: (scope, node) => host.hasSubscription(scope, node),
            token: () => host.createOutcomeToken(),
            epoch: () => host.sourceEpoch,
            count: (counter, amount) => host.recordCounter(counter, amount),
            advanceEpoch: () => {
                host.sourceEpoch++
                host.recordCounter(StoreTreeCounterId.sourceEpoch)
                host.recordCounter(StoreTreeCounterId.propagationSettlements)
            },
            reach: (scope, node) => {
                host.reachSubscriptionTarget(scope, node)
                scope.markDependents(node)
            },
            settleRead: prepare => {
                host.beginNotificationSettlement()
                try {
                    host.propagateFromSources(undefined, undefined, () => {
                        try {
                            prepare()
                        } catch (error) {
                            this.failure(error, "sampling")
                        }
                    })
                } catch (error) {
                    this.failure(error)
                } finally {
                    host.clearNotificationSettlement()
                }
            },
        }
        this.#delivery = delivery
        this.#bounds = bounds
    }

    /** @internal Read-only invariant probe for the projection test harness. */
    inspectRetryRequired(node: AnyState): boolean {
        return this.#projections.get(node)?.generation?.retryRequired === true
    }

    #event(code: ExternalInspectionEvent, node?: AnyState): void {
        const event = this.#bindings.event
        if (event === undefined) return
        const previous = this.#operation?.phase
        this.phase(ExternalOperationPhase.instrumenting)
        try {
            event(
                code,
                node,
                node === undefined
                    ? undefined
                    : this.#bindings.domain.externalAtoms!.get(node)?.name,
            )
        } catch (error) {
            this.failure(error, "instrumenting")
        } finally {
            if (previous !== undefined) this.phase(previous)
        }
    }

    reaches(scope: StoreScopeNode, node: AnyState): boolean {
        return (
            scope.externalRecord(node)?.lifecycleInClosure ??
            this.#bindings.domain.externalAtoms!.has(node)
        )
    }
    reachesDormant(scope: StoreScopeNode, node: AnyState): boolean {
        return (
            scope.externalRecord(node)?.dormantExternalInClosure ??
            (this.#bindings.domain.externalAtoms!.has(node) &&
                !this.active(node))
        )
    }
    selectorRecord(
        scope: StoreScopeNode,
        record: SelectorRecord,
        session: SelectorEvaluationSession<AnyState>,
    ): SelectorRecord {
        return Object.freeze({
            ...record,
            lifecycleInClosure: record.dependencies.some(dependency =>
                this.reaches(scope, dependency.node),
            ),
            dormantExternalInClosure: record.dependencies.some(dependency =>
                this.reachesDormant(scope, dependency.node),
            ),
        })
    }
    refreshActivity(scope: StoreScopeNode, node: AnyState): void {
        const pending: AnyState[] = []
        scope.externalDependents(node)?.forEach(parent => pending.push(parent))
        for (let index = 0; index < pending.length; index++) {
            const current = pending[index]!,
                record = scope.externalRecord(current)
            if (record === undefined) continue
            const dormantExternalInClosure = record.dependencies.some(
                dependency => this.reachesDormant(scope, dependency.node),
            )
            if (dormantExternalInClosure === record.dormantExternalInClosure)
                continue
            scope.replaceExternalRecord(
                current,
                Object.freeze({ ...record, dormantExternalInClosure }),
            )
            scope
                .externalDependents(current)
                ?.forEach(parent => pending.push(parent))
        }
    }
    publishedSelector(
        scope: StoreScopeNode,
        node: AnyState,
        previous: SelectorRecord | undefined,
        record: SelectorRecord,
    ): void {
        if (
            previous !== undefined &&
            previous.dormantExternalInClosure !==
                record.dormantExternalInClosure
        )
            this.refreshActivity(scope, node)
        this.reconcile(scope, node)
        if (
            previous === undefined ||
            previous.lifecycleInClosure === record.lifecycleInClosure
        )
            return
        const pending: AnyState[] = []
        scope.externalDependents(node)?.forEach(parent => pending.push(parent))
        for (let index = 0; index < pending.length; index++) {
            const current = pending[index]!,
                entry = scope.externalRecord(current)
            if (entry === undefined) continue
            const lifecycleInClosure = entry.dependencies.some(dependency =>
                this.reaches(scope, dependency.node),
            )
            if (lifecycleInClosure !== entry.lifecycleInClosure) {
                scope.replaceExternalRecord(
                    current,
                    Object.freeze({ ...entry, lifecycleInClosure }),
                )
                scope
                    .externalDependents(current)
                    ?.forEach(parent => pending.push(parent))
            }
            this.reconcile(scope, current)
        }
    }

    observe(
        scope: StoreScopeNode,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken> {
        if (
            !this.reaches(scope, node) &&
            (!this.#bindings.domain.selectors.has(node) ||
                scope.getSelectorRecord(node) !== undefined)
        )
            return scope.serveKnownLocal(node, session)
        return this.read(scope, node, session)
    }

    admit(registration: SubscriptionRegistration, token: OutcomeToken): void {
        registration.status = "provisional"
        registration.admissionToken = token
        this.#operation!.registration = registration
        const target = registration.target!
        this.retainRoot(target.scope, target.state)
        this.startup()
    }

    notificationCallback(
        registration: SubscriptionRegistration,
    ): (() => unknown) | undefined {
        if (
            registration.target === undefined ||
            registration.status === "rolled-back"
        )
            return
        const callback = registration.callback
        if (registration.status === "provisional") {
            const target = registration.target!
            const token = target.scope.getMaterializedServedOutcome(
                target.state,
            )?.token
            if (
                !this.admissionAllowed ||
                registration.admissionNotified ||
                (token !== undefined && token === registration.admissionToken)
            )
                return
            if (callback !== undefined) registration.admissionNotified = true
        }
        return callback
    }

    beginHost(
        cursor: number,
        epoch: number,
        faults?: readonly Extract<
            ServedSelectorOutcome<OutcomeToken>["outcome"],
            { kind: "control-error" }
        >[],
    ): void {
        const kind = cursor & HostOperationCursor.kindMask
        const phase = cursor >> HostOperationCursor.phaseShift
        this.begin(
            kind === HostOperationKind.read
                ? "external-read"
                : kind === HostOperationKind.subscribe
                  ? "external-startup"
                  : "owned-mutation",
            epoch,
            phase === 0 ? undefined : phase - 1,
            faults,
        )
    }

    begin(
        source: ExternalOperationFailure["source"],
        epoch: number,
        phase?: ExternalOperationPhase,
        faults?: readonly Extract<
            ServedSelectorOutcome<OutcomeToken>["outcome"],
            { kind: "control-error" }
        >[],
    ): void {
        this.#operation = {
            source,
            initialSource: source,
            phase:
                phase ??
                (source === "owned-mutation"
                    ? ExternalOperationPhase.drafting
                    : source === "external-cleanup"
                      ? ExternalOperationPhase.disposing
                      : ExternalOperationPhase.materializingRead),
            epoch,
            failures: [],
            internal: [],
            originals: [],
            controlOrigins: new Set(),
            terminal: false,
            attachments: 0,
        }
        if (faults !== undefined)
            for (const fault of faults)
                this.failure(fault.error, "settling", fault.origin)
        // Also covers first installation midway through a host evaluation.
        this.#pull = this.#newPull(
            source === "external-read" || source === "external-startup",
        )
        for (const projection of this.#unattached) {
            if (projection.retains > 0 && projection.status === "dormant")
                this.#attachments.add(projection)
        }
    }

    cleanup<Result>(operation: () => Result): Result {
        return this.run("external-cleanup", operation)
    }

    run<Result>(
        source: ExternalOperationFailure["source"],
        operation: () => Result,
    ): Result {
        if (!this.idle) return operation()
        this.begin(source, this.#bindings.epoch())
        let result!: Result
        try {
            result = operation()
        } catch (error) {
            this.failure(error)
        } finally {
            this.finish()
        }
        return result
    }

    finish(): void {
        const frame = this.#operation!
        try {
            try {
                this.startup()
            } catch (error) {
                this.failure(error)
            }
            this.#flushReleases()
            this.#drain()
            const registration = frame.registration
            if (registration !== undefined) {
                if (frame.failures.length > 0) {
                    try {
                        registration.target?.host?.removeSubscription(
                            registration,
                        )
                    } catch (error) {
                        this.failure(error, "cleanup")
                    }
                    registration.status = "rolled-back"
                    this.#flushReleases()
                } else {
                    registration.status = "active"
                    delete registration.admissionToken
                    delete registration.admissionNotified
                }
            }
        } finally {
            this.#operation = undefined
            this.#pull = undefined
        }
        if (frame.failures.length > 0) {
            if (
                frame.initialSource === "owned-mutation" &&
                frame.originals.length === 1 &&
                frame.failures.every(
                    failure => failure.source === "owned-mutation",
                )
            )
                throw frame.originals[0]
            this.#bindings.domain.externalRuntime!.fail(
                frame.failures,
                false,
                frame.internal,
            )
        }
    }

    phase(phase: ExternalOperationPhase): void {
        if (this.#operation !== undefined) this.#operation.phase = phase
    }

    failure(
        error: unknown,
        phase?: ExternalOperationFailure["phase"],
        origin?: object,
    ): void {
        if (error === recordedExternalFailure) return
        const frame = this.#operation
        if (frame === undefined) throw error
        // An origin identifies a control occurrence, never an application error.
        // Propagation shares it; independent callbacks always receive new origins.
        if (origin !== undefined) {
            if (frame.controlOrigins.has(origin)) return
            frame.controlOrigins.add(origin)
        }
        frame.originals.push(error)
        frame.internal.push(origin !== undefined)
        frame.failures.push({
            cause: error,
            phase: phase ?? this.#failurePhase(),
            source: frame.source,
            committed: this.#bindings.epoch() !== frame.epoch,
        })
    }

    // Only the core's completed notification boundary can forward this wrapper.
    // Public error instances thrown by application callbacks remain raw causes.
    notificationFailure(error: SubscriberNotificationError): unknown {
        const frame = this.#operation
        if (frame === undefined) return error
        frame.originals.push(error)
        for (const cause of error.causes) {
            frame.internal.push(false)
            frame.failures.push({
                cause,
                phase: "notifying",
                source: frame.source,
                committed: this.#bindings.epoch() !== frame.epoch,
            })
        }
        return recordedExternalFailure
    }

    #failureMetadata(
        phase: ExternalOperationFailure["phase"],
    ): Pick<ExternalOperationFailure, "phase" | "source" | "committed"> {
        const frame = this.#operation!
        return {
            phase,
            source: frame.source,
            committed: this.#bindings.epoch() !== frame.epoch,
        }
    }

    #failurePhase(): ExternalOperationFailure["phase"] {
        switch (this.#operation?.phase) {
            case ExternalOperationPhase.transitioningLifecycle:
            case ExternalOperationPhase.drafting:
            case ExternalOperationPhase.preflight:
                return "admitting"
            case ExternalOperationPhase.materializingRead:
            case ExternalOperationPhase.samplingExternal:
                return "sampling"
            case ExternalOperationPhase.notifying:
                return "notifying"
            case ExternalOperationPhase.instrumenting:
                return "instrumenting"
            case ExternalOperationPhase.cleanup:
            case ExternalOperationPhase.disposing:
                return "cleanup"
            default:
                return "settling"
        }
    }

    startup(): void {
        if (this.#attachments.size === 0) return
        const previous = this.#pull
        const source = this.#operation!.source
        // A cleanup may retry an earlier failed attachment. Its catch-up
        // notifications belong to that startup, while cleanup retains its phase.
        if (source === "external-cleanup")
            this.#operation!.source = "external-startup"
        this.#pull = this.#newPull(false)
        this.#pull.epochAdvanced = false
        try {
            this.#bindings.settleRead(() => {})
        } finally {
            this.#pull = previous
            this.#operation!.source = source
        }
    }

    settleLifecycle(): boolean {
        if (this.#attachments.size === 0) return false
        this.phase(ExternalOperationPhase.transitioningLifecycle)
        const pending = [...this.#attachments]
        this.#attachments.clear()
        for (const projection of pending) {
            if (projection.retains === 0 || projection.status !== "dormant")
                continue
            if (this.#operation!.terminal) continue
            if (this.#operation!.attachments++ >= this.#bounds.samples) {
                this.#operation!.terminal = true
                this.failure(
                    new ExternalSourceNonConvergenceError(
                        this.#failureMetadata("admitting"),
                    ),
                    "admitting",
                    {},
                )
                continue
            }
            try {
                this.#attach(projection)
            } catch (error) {
                this.failure(error, "admitting")
            }
        }
        this.phase(ExternalOperationPhase.propagating)
        return true
    }

    #attach(projection: Projection): void {
        const domain = this.#bindings.domain
        const previousSource = this.#operation!.source
        this.#operation!.source = "external-startup"
        const definition = domain.externalAtoms!.get(projection.node)!
        const generation: Generation = {
            owner: this,
            projection,
            cleanup: undefined,
        }
        projection.generation = generation
        projection.status = "attaching"
        this.#bindings.count(StoreTreeCounterId.adapterSubscriptions)
        this.#event(ExternalInspectionEvent.attach, projection.node)
        const session = new SelectorEvaluationSession<AnyState>()
        let origin: object | undefined
        try {
            runExternalCallback(
                domain,
                session,
                "external-subscribe",
                () => {
                    let returned: unknown
                    try {
                        returned = Reflect.apply(
                            definition.subscribe,
                            definition.source,
                            [invalidator(generation)],
                        )
                    } catch (error) {
                        throw this.#completionError(error)
                    }
                    const inspected = inspectThenable(returned)
                    if (inspected.kind === "inspection-error")
                        throw inspected.error
                    if (inspected.kind === "thenable") {
                        this.#bindings.count(
                            StoreTreeCounterId.thenableContainments,
                        )
                        containThenable(inspected)
                        throw this.#invalidCleanup()
                    }
                    if (typeof returned !== "function")
                        throw this.#invalidCleanup()
                    generation.cleanup = returned as () => unknown
                },
                generation,
                token => {
                    origin = token
                },
            )
            this.#dirty.delete(generation)
            const sampled = this.#sample(projection.node, session)
            this.#publish(projection.node, sampled)
            projection.status = "active"
            projection.scopes.forEach(scope => {
                if (scope.status === "live")
                    this.refreshActivity(scope, projection.node)
            })
            this.#unattached.delete(projection)
        } catch (error) {
            const fault = session.getControlFault()
            this.failure(
                error,
                "admitting",
                fault.kind === "fault" ? fault.origin : origin,
            )
            this.#cleanup(projection)
            // Already recorded before cleanup, so later failures cannot reorder it.
        } finally {
            this.#operation!.source = previousSource
        }
    }

    #revoke(projection: Projection): (() => unknown) | undefined {
        const generation = projection.generation
        if (generation === undefined) return
        this.#dirty.delete(generation)
        const cleanup = generation.cleanup
        generation.owner = undefined
        generation.projection = undefined
        generation.cleanup = undefined
        delete projection.generation
        return cleanup
    }

    #invalidCleanup(): InvalidExternalCleanupError {
        const error = new InvalidExternalCleanupError(
            this.#failureMetadata(
                this.#operation?.phase === ExternalOperationPhase.cleanup
                    ? "cleanup"
                    : "admitting",
            ),
        )
        this.#bindings.domain.externalRuntime!.guard(error)
        return error
    }

    #completionError(thrown: unknown): unknown {
        const inspected = inspectThenable(thrown)
        if (inspected.kind === "inspection-error") return inspected.error
        if (inspected.kind === "thenable") {
            this.#bindings.count(StoreTreeCounterId.thenableContainments)
            containThenable(inspected)
            return this.#invalidCleanup()
        }
        return thrown
    }

    #cleanup(projection: Projection): void {
        const previousPhase = this.#operation?.phase
        this.phase(ExternalOperationPhase.cleanup)
        const cleanup = this.#revoke(projection)
        projection.status = "detaching"
        if (cleanup !== undefined) {
            this.#bindings.count(StoreTreeCounterId.adapterCleanups)
            this.#event(ExternalInspectionEvent.detach, projection.node)
            const previous = this.#operation!.source
            this.#operation!.source = "external-cleanup"
            let origin: object | undefined
            try {
                runExternalCallback(
                    this.#bindings.domain,
                    new SelectorEvaluationSession(),
                    "external-cleanup",
                    () => {
                        let returned: unknown
                        try {
                            returned = cleanup()
                        } catch (error) {
                            throw this.#completionError(error)
                        }
                        const inspected = inspectThenable(returned)
                        if (inspected.kind === "inspection-error")
                            throw inspected.error
                        if (inspected.kind === "thenable") {
                            this.#bindings.count(
                                StoreTreeCounterId.thenableContainments,
                            )
                            containThenable(inspected)
                            throw this.#invalidCleanup()
                        }
                    },
                    undefined,
                    token => {
                        origin = token
                    },
                )
            } catch (error) {
                this.failure(error, "cleanup", origin)
            } finally {
                this.#operation!.source = previous
            }
        }
        projection.status = "dormant"
        projection.scopes.forEach(scope => {
            if (scope.status === "live")
                this.refreshActivity(scope, projection.node)
        })
        if (previousPhase !== undefined) this.phase(previousPhase)
    }

    #flushReleases(): void {
        for (const projection of this.#releases) {
            this.#releases.delete(projection)
            if (projection.retains !== 0) continue
            this.#unattached.delete(projection)
            this.#attachments.delete(projection)
            this.#cleanup(projection)
        }
    }

    invalidate(generation: Generation): void {
        const projection = generation.projection
        if (generation.owner !== this || projection === undefined) return
        const activity = this.#bindings.domain.activity
        if (
            activity?.kind === "external-subscribe" &&
            activity.generation === generation
        ) {
            if (this.#operation?.terminal) return
            delete generation.retryRequired
            this.#dirty.add(generation)
            return
        }
        if (activity !== undefined && activity.kind !== "subscriber") {
            rejectCallbackOperation(this.#bindings.domain)
        }
        if (this.#operation?.terminal) return
        delete generation.retryRequired
        if (this.#operation !== undefined) {
            this.#event(ExternalInspectionEvent.invalidate, projection.node)
            this.#dirty.add(generation)
            return
        }
        const delivery = this.#delivery
        if (delivery.depth === 0) delivery.work = 0
        if (
            delivery.depth >= this.#bounds.deliveryDepth ||
            delivery.work >= this.#bounds.deliveryWork
        ) {
            generation.retryRequired = true
            this.#bindings.count(StoreTreeCounterId.deliveryLimitHits)
            const limit = new ExternalSourceDeliveryLimitError()
            try {
                this.#event(
                    ExternalInspectionEvent.deliveryLimit,
                    projection.node,
                )
            } catch (cause) {
                this.#bindings.domain.externalRuntime!.fail([
                    {
                        cause: limit,
                        phase: "sampling",
                        source: "external-invalidation",
                        committed: false,
                    },
                    {
                        cause,
                        phase: "instrumenting",
                        source: "external-invalidation",
                        committed: false,
                    },
                ])
            }
            throw limit
        }
        delivery.depth++
        delivery.work++
        this.#bindings.count(StoreTreeCounterId.deliveryEntries)
        try {
            this.run("external-invalidation", () => {
                this.#event(ExternalInspectionEvent.invalidate, projection.node)
                this.#dirty.add(generation)
            })
        } finally {
            delivery.depth--
        }
    }

    #drain(): void {
        let rounds = 0,
            samples = 0
        const frame = this.#operation!
        while (this.#dirty.size > 0) {
            if (
                rounds >= this.#bounds.rounds ||
                samples >= this.#bounds.samples
            ) {
                this.#exhaust([...this.#dirty])
                return
            }
            const batch = [...this.#dirty]
            this.#dirty.clear()
            rounds++
            this.#bindings.count(StoreTreeCounterId.dirtyRounds)
            this.#event(ExternalInspectionEvent.drain)
            frame.source =
                rounds === 1 && frame.source === "external-invalidation"
                    ? "external-invalidation"
                    : "external-drain"
            frame.phase = ExternalOperationPhase.drainingExternal
            const outcomes: [
                Projection,
                ServedSelectorOutcome<OutcomeToken>["outcome"],
            ][] = []
            const sampleFailures: { error: unknown; origin?: object }[] = []
            let cursor = 0
            for (; cursor < batch.length; cursor++) {
                const generation = batch[cursor]!,
                    projection = generation.projection
                if (
                    generation.owner !== this ||
                    projection?.status !== "active"
                )
                    continue
                if (samples >= this.#bounds.samples) break
                samples++
                this.#bindings.count(StoreTreeCounterId.dirtySamples)
                const session = new SelectorEvaluationSession<AnyState>()
                try {
                    outcomes.push([
                        projection,
                        this.#sample(projection.node, session),
                    ])
                } catch (error) {
                    const fault = session.getControlFault()
                    const origin = fault.kind === "fault" ? fault.origin : {}
                    outcomes.push([
                        projection,
                        Object.freeze({ kind: "control-error", error, origin }),
                    ])
                    sampleFailures.push({ error, origin })
                }
            }
            if (cursor < batch.length) {
                const pending = [...batch.slice(cursor), ...this.#dirty]
                this.#exhaust(pending, outcomes, sampleFailures)
                return
            }
            this.#round(outcomes, sampleFailures)
            this.#flushReleases()
        }
    }

    #round(
        outcomes: readonly (readonly [
            Projection,
            ServedSelectorOutcome<OutcomeToken>["outcome"],
        ])[],
        sampleFailures: readonly { error: unknown; origin?: object }[] = [],
    ): void {
        const previous = this.#pull
        this.#pull = this.#newPull(false)
        this.#pull.epochAdvanced = false
        try {
            this.#bindings.settleRead(() => {
                for (const [projection, outcome] of outcomes)
                    this.#publish(projection.node, outcome)
                for (const { error, origin } of sampleFailures)
                    this.failure(error, "sampling", origin)
            })
        } catch (error) {
            this.failure(error)
        } finally {
            this.#pull = previous
        }
    }

    #exhaust(
        pending: readonly Generation[],
        earlier: readonly [
            Projection,
            ServedSelectorOutcome<OutcomeToken>["outcome"],
        ][] = [],
        sampleFailures: readonly { error: unknown; origin?: object }[] = [],
    ): void {
        this.#operation!.terminal = true
        this.#operation!.source = "external-drain"
        const error = new ExternalSourceNonConvergenceError({
            ...this.#failureMetadata("sampling"),
            committed: true,
        })
        this.#bindings.count(StoreTreeCounterId.nonConvergenceTerminations)
        this.#event(ExternalInspectionEvent.nonconvergence)
        const outcomes: [
            Projection,
            ServedSelectorOutcome<OutcomeToken>["outcome"],
        ][] = [...earlier]
        for (const generation of new Set(pending)) {
            if (
                generation.owner === this &&
                generation.projection?.status === "active"
            )
                outcomes.push([
                    generation.projection,
                    Object.freeze({ kind: "error", error }),
                ])
        }
        this.#dirty.clear()
        this.#round(outcomes, [...sampleFailures, { error }])
        this.#flushReleases()
        this.#dirty.clear()
    }
    get dormantPull(): boolean {
        return this.#pull?.dormant === true
    }
    get idle(): boolean {
        return this.#operation === undefined
    }
    get pendingLifecycle(): boolean {
        return this.#attachments.size > 0
    }
    active(node: AnyState): boolean {
        return this.#projections.get(node)?.status === "active"
    }
    get admissionAllowed(): boolean {
        return this.#operation?.failures.length === 0
    }
    installed(
        scope: StoreScopeNode,
        node: AnyState,
    ): ServedSelectorOutcome<OutcomeToken> | undefined {
        return (
            scope.getMaterializedServedOutcome(node) ??
            this.#projections.get(node)?.served
        )
    }
    current(scope: StoreScopeNode, node: AnyState): boolean {
        return (
            this.active(node) ||
            (!this.reachesDormant(scope, node) &&
                scope.getMaterializedServedOutcome(node) !== undefined)
        )
    }

    #records(scope: StoreScopeNode): WeakMap<AnyState, RetainRecord> {
        let records = this.#retains.get(scope)
        if (records === undefined)
            this.#retains.set(scope, (records = new WeakMap()))
        return records
    }

    #dependencies(scope: StoreScopeNode, node: AnyState): Set<AnyState> {
        const result = new Set<AnyState>()
        for (const dependency of scope.getCommittedSelectorDependencies(
            node as never,
        ) ?? []) {
            if (this.reaches(scope, dependency.node))
                result.add(dependency.node)
        }
        return result
    }

    // Count incoming lifecycle edges, independently of selector graph/cache ownership.
    // Only the first edge traverses a shared branch. Both walks are iterative.
    #retain(scope: StoreScopeNode, node: AnyState): void {
        const records = this.#records(scope)
        const pending = [node]
        while (pending.length > 0) {
            const current = pending.pop()!
            this.#bindings.count(StoreTreeCounterId.lifecycleEdgeVisits)
            let record = records.get(current)
            if (record === undefined)
                records.set(
                    current,
                    (record = {
                        count: 0,
                        root: false,
                        dependencies: new Set(),
                    }),
                )
            if (record.count++ !== 0) continue
            if (this.#bindings.domain.externalAtoms!.has(current)) {
                const projection = this.#projections.get(current)!
                if (projection.retains++ === 0) {
                    this.#bindings.count(StoreTreeCounterId.lifecycleRetains)
                    this.#releases.delete(projection)
                    if (projection.status === "dormant") {
                        this.#attachments.add(projection)
                        this.#unattached.add(projection)
                    }
                }
                continue
            }
            record.dependencies = this.#dependencies(scope, current)
            for (const dependency of record.dependencies)
                pending.push(dependency)
        }
    }

    #release(scope: StoreScopeNode, node: AnyState): void {
        const records = this.#retains.get(scope)
        const pending = [node]
        while (pending.length > 0) {
            const current = pending.pop()!
            const record = records?.get(current)
            if (record === undefined || record.count === 0) continue
            this.#bindings.count(StoreTreeCounterId.lifecycleEdgeVisits)
            if (--record.count !== 0) continue
            if (this.#bindings.domain.externalAtoms!.has(current)) {
                const projection = this.#projections.get(current)!
                if (--projection.retains === 0) {
                    this.#bindings.count(StoreTreeCounterId.lifecycleReleases)
                    this.#releases.add(projection)
                }
            } else {
                for (const dependency of record.dependencies)
                    pending.push(dependency)
                record.dependencies.clear()
            }
            records!.delete(current)
        }
    }

    retainRoot(scope: StoreScopeNode, node: AnyState): void {
        if (!this.reaches(scope, node)) return
        if (this.#retains.get(scope)?.get(node)?.root) return
        this.#retain(scope, node)
        this.#retains.get(scope)!.get(node)!.root = true
    }

    releaseRoot(scope: StoreScopeNode, node: AnyState): void {
        const record = this.#retains.get(scope)?.get(node)
        if (!record?.root) return
        record.root = false
        this.#release(scope, node)
    }

    reconcile(scope: StoreScopeNode, node: AnyState): void {
        if (
            this.#bindings.subscribed(scope, node) &&
            this.reaches(scope, node)
        ) {
            this.retainRoot(scope, node)
        } else this.releaseRoot(scope, node)
        const record = this.#retains.get(scope)?.get(node)
        if (
            record === undefined ||
            this.#bindings.domain.externalAtoms!.has(node)
        )
            return
        const next = this.#dependencies(scope, node)
        // Acquire replacement branches before releasing previous branches, even
        // when the selector's comparison preserves its outcome token.
        for (const dependency of next) {
            if (!record.dependencies.has(dependency))
                this.#retain(scope, dependency)
        }
        for (const dependency of record.dependencies) {
            if (!next.has(dependency)) this.#release(scope, dependency)
        }
        record.dependencies = next
    }

    #newPull(dormant: boolean): Pull {
        return {
            samples: new Map(),
            refreshed: new WeakMap(),
            dormant,
            epochAdvanced: !dormant,
        }
    }

    beginPropagation(): unknown {
        const previous = this.#pull
        this.#pull ??= this.#newPull(false)
        return previous
    }
    endPropagation(previous: unknown): void {
        this.#pull = previous as Pull | undefined
    }

    recordSelectorFault(
        scope: StoreScopeNode,
        node: AnyState,
        error: unknown,
    ): boolean {
        if (!this.#pull?.dormant) return false
        const byScope = (this.#pull.selectorFaults ??= new WeakMap())
        let faults = byScope.get(scope)
        if (faults === undefined) byScope.set(scope, (faults = new Map()))
        faults.set(node, error)
        return true
    }

    skipSelectorRead(
        scope: StoreScopeNode,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): boolean {
        if (this.#pull?.dormant && !this.#pull.epochAdvanced) return true
        const faults = this.#pull?.selectorFaults?.get(scope)
        if (!faults?.has(node)) return false
        const error = faults.get(node)
        session.latchControlFault(error)
        throw error
    }

    read(
        scope: StoreScopeNode,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken> {
        if (this.current(scope, node))
            return scope.serveKnownLocal(node, session)
        this.#pull = this.#newPull(true)
        const failureCount = this.#operation!.failures.length
        let served: ServedSelectorOutcome<OutcomeToken> | undefined
        try {
            this.#bindings.settleRead(() => {
                this.refresh(scope, node, session)
                served = scope.serveKnownLocal(node, session)
            })
            if (this.#operation!.failures.length !== failureCount)
                throw recordedExternalFailure
            return (
                scope.getMaterializedServedOutcome(node) ??
                this.#projections.get(node)?.served ??
                served!
            )
        } finally {
            this.#pull = undefined
        }
    }

    #rejectSubscriberRead(session: SelectorEvaluationSession<AnyState>): void {
        if (
            !this.#bindings.subscriberRead() &&
            this.#bindings.domain.activity?.kind !== "subscriber"
        )
            return
        const error = new DormantExternalReadError()
        session.latchControlFault(error)
        const activity = this.#bindings.domain.activity
        if (activity?.kind === "subscriber")
            activity.session.latchControlFault(error)
        throw error
    }

    refresh(
        scope: StoreScopeNode,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): void {
        if (!this.reaches(scope, node)) return
        if (!this.reachesDormant(scope, node)) return
        const pull = this.#pull
        // Subscriber reads still inspect a dormant closure before serving a
        // clean cached selector, but do not publish or poll any source.
        if (
            pull === undefined &&
            !this.#bindings.subscriberRead() &&
            this.#bindings.domain.activity?.kind !== "subscriber"
        )
            return
        let visited = pull?.refreshed.get(scope)
        if (visited === undefined)
            pull?.refreshed.set(scope, (visited = new WeakSet()))
        visited ??= new WeakSet()
        const pending = [node]
        while (pending.length > 0) {
            const current = pending.pop()!
            if (this.#bindings.domain.externalAtoms!.has(current)) {
                this.serve(scope, current, session)
                continue
            }
            if (visited.has(current)) continue
            visited.add(current)
            this.#bindings.count(StoreTreeCounterId.externalClosureVisits)
            const dependencies =
                scope.getCommittedSelectorDependencies(current as never) ?? []
            for (let index = dependencies.length - 1; index >= 0; index--) {
                const dependency = dependencies[index]!.node
                if (this.reaches(scope, dependency)) pending.push(dependency)
            }
        }
    }

    serve(
        scope: StoreScopeNode,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken> {
        const active = this.#projections.get(node)
        if (active?.status === "active") {
            active.scopes.add(scope)
            return active.served
        }
        this.#rejectSubscriberRead(session)
        if (this.#pull === undefined && this.#bindings.propagating())
            this.#pull = this.#newPull(false)
        const sampled = this.#pull?.samples.get(node)
        if (sampled !== undefined) {
            this.#projections.get(node)!.scopes.add(scope)
            return sampled
        }
        if (this.#pull?.faults?.has(node)) {
            const error = this.#pull.faults.get(node)
            session.latchControlFault(error)
            throw error
        }
        this.#bindings.count(StoreTreeCounterId.externalClosureVisits)
        let outcome: ServedSelectorOutcome<OutcomeToken>["outcome"]
        try {
            outcome = this.#sample(node, session)
        } catch (error) {
            if (this.#pull !== undefined)
                (this.#pull.faults ??= new Map()).set(node, error)
            throw error
        }
        const served = this.#publish(node, outcome)
        this.#projections.get(node)!.scopes.add(scope)
        return served
    }

    #sample(
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken>["outcome"] {
        this.#bindings.count(StoreTreeCounterId.liveSamples)
        this.#event(ExternalInspectionEvent.sample, node)
        const previous = this.#operation?.phase
        this.phase(ExternalOperationPhase.samplingExternal)
        try {
            return sampleExternal(
                this.#bindings.domain,
                this.#bindings.domain.externalAtoms!.get(node)!,
                session,
                undefined,
                () =>
                    this.#bindings.count(
                        StoreTreeCounterId.thenableContainments,
                    ),
            )
        } finally {
            if (previous !== undefined) this.phase(previous)
        }
    }

    #publish(
        node: AnyState,
        outcome: ServedSelectorOutcome<OutcomeToken>["outcome"],
    ): ServedSelectorOutcome<OutcomeToken> {
        let projection = this.#projections.get(node)
        const previous = projection?.served
        const same =
            previous !== undefined && sameOutcome(previous.outcome, outcome)
        if (!same) {
            const served = Object.freeze({
                token: this.#bindings.token(),
                outcome,
            })
            if (projection === undefined) {
                projection = {
                    node,
                    served,
                    retains: 0,
                    status: "dormant",
                    scopes: new WeakHandleSet(() =>
                        this.#bindings.count(
                            StoreTreeCounterId.deadRouteCompactions,
                        ),
                    ),
                }
                this.#projections.set(node, projection)
            } else projection.served = served
            this.#bindings.count(StoreTreeCounterId.projectionPublications)
            if (previous !== undefined && this.#pull?.epochAdvanced === false) {
                this.#pull.epochAdvanced = true
                this.#bindings.advanceEpoch()
            }
            this.#event(ExternalInspectionEvent.publish, node)
        }
        const served = projection!.served
        this.#pull?.samples.set(node, served)
        if (previous !== undefined && previous !== served) {
            projection!.scopes.forEach(route => {
                this.#bindings.count(StoreTreeCounterId.routeVisits)
                if (route.status === "live") this.#bindings.reach(route, node)
            })
        }
        return served
    }
}
