import {
    SelectorEvaluationSession,
    type ServedSelectorOutcome,
} from "../selector-evaluator/types"
import {
    CallbackCapabilityError,
    SubscriberNotificationError,
    containThenable,
    inspectThenable,
    type AnyState,
} from "./runtime-domain"
import {
    WeakHandleSet,
    type OutcomeToken,
    type StoreScopeNode,
} from "./scope-node"
import {
    DormantExternalReadError,
    ExternalSourceOperationError,
    ExternalSourceNonConvergenceError,
    ExternalSourceDeliveryLimitError,
    InvalidExternalCleanupError,
    runExternalCallback,
    sampleExternal,
} from "./external-atom"
import type {
    ExternalBounds,
    ExternalOperationFailure,
    ExternalOperationPhase,
    ExternalTreeBindings,
    ExternalTreePlane,
} from "./external-types"
interface Generation {
    owner: ExternalProjectionPlane | undefined
    projection: Projection | undefined
    cleanup: (() => unknown) | undefined
}
// A departed callback retains only this cleared ticket, never its old tree.
const invalidator = (generation: Generation) => () =>
    generation.owner?.invalidate(generation)
interface Operation {
    source: ExternalOperationFailure["source"]
    phase: ExternalOperationPhase
    readonly epoch: number
    readonly failures: ExternalOperationFailure[]
    readonly originals: unknown[]
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
    retryRequired?: boolean
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
        bindings: ExternalTreeBindings,
        delivery: { depth: number; work: number },
        bounds: ExternalBounds,
    ) {
        this.#bindings = bindings
        this.#delivery = delivery
        this.#bounds = bounds
    }

    run<Result>(
        source: ExternalOperationFailure["source"],
        operation: () => Result,
        rollback?: () => void,
    ): Result {
        if (this.#operation !== undefined) return operation()
        const frame: Operation = {
            source,
            phase:
                source === "external-startup"
                    ? "transitioningLifecycle"
                    : source === "owned-mutation"
                      ? "drafting"
                      : source === "external-cleanup"
                        ? "disposing"
                        : "materializingRead",
            epoch: this.#bindings.epoch(),
            failures: [],
            originals: [],
            terminal: false,
            attachments: 0,
        }
        this.#operation = frame
        for (const projection of this.#unattached) {
            if (projection.retains > 0 && projection.status === "dormant")
                this.#attachments.add(projection)
        }
        let result!: Result
        try {
            try {
                result = operation()
            } catch (error) {
                this.failure(error)
            }
            try {
                this.startup()
            } catch (error) {
                this.failure(error)
            }
            this.#flushReleases()
            this.#drain()
            if (frame.failures.length > 0 && rollback !== undefined) {
                try {
                    rollback()
                } catch (error) {
                    this.failure(error, "cleanup")
                }
                this.#flushReleases()
            }
        } finally {
            this.#operation = undefined
        }
        if (frame.failures.length > 0) {
            // The external-free mutation contract retains its exact legacy wrapper.
            if (
                source === "owned-mutation" &&
                frame.originals.length === 1 &&
                frame.failures.every(
                    failure => failure.source === "owned-mutation",
                )
            )
                throw frame.originals[0]
            this.#bindings.domain.externalRuntime!.fail(frame.failures)
        }
        return result
    }

    phase(phase: ExternalOperationPhase): void {
        if (this.#operation !== undefined) this.#operation.phase = phase
    }

    failure(
        error: unknown,
        phase: ExternalOperationFailure["phase"] = this.#failurePhase(),
    ): void {
        const frame = this.#operation
        if (frame === undefined) throw error
        frame.originals.push(error)
        if (error instanceof ExternalSourceOperationError) {
            frame.failures.push(
                ...error.failures.map(failure =>
                    failure.source === "external-read"
                        ? { ...failure, source: frame.source }
                        : failure,
                ),
            )
            return
        }
        for (const cause of error instanceof SubscriberNotificationError
            ? error.causes
            : [error]) {
            frame.failures.push({
                cause,
                phase:
                    error instanceof SubscriberNotificationError
                        ? "notifying"
                        : phase,
                source: frame.source,
                committed: this.#bindings.epoch() !== frame.epoch,
            })
        }
    }

    #failurePhase(): ExternalOperationFailure["phase"] {
        switch (this.#operation?.phase) {
            case "transitioningLifecycle":
            case "drafting":
            case "preflight":
                return "admitting"
            case "materializingRead":
            case "samplingExternal":
                return "sampling"
            case "notifying":
                return "notifying"
            case "instrumenting":
                return "instrumenting"
            case "cleanup":
            case "disposing":
                return "cleanup"
            default:
                return "settling"
        }
    }

    startup(): void {
        if (this.#attachments.size === 0) return
        const previous = this.#pull
        this.#pull = this.#newPull(false)
        this.#pull.epochAdvanced = false
        try {
            this.#bindings.settleRead(() => {})
        } finally {
            this.#pull = previous
        }
    }

    settleLifecycle(): boolean {
        if (this.#attachments.size === 0) return false
        this.phase("transitioningLifecycle")
        const pending = [...this.#attachments]
        this.#attachments.clear()
        for (const projection of pending) {
            if (projection.retains === 0 || projection.status !== "dormant")
                continue
            if (this.#operation!.terminal) continue
            if (this.#operation!.attachments++ >= this.#bounds.samples) {
                this.#operation!.terminal = true
                this.failure(
                    new ExternalSourceNonConvergenceError(),
                    "admitting",
                )
                continue
            }
            try {
                this.#attach(projection)
            } catch (error) {
                this.failure(error, "admitting")
            }
        }
        this.phase("propagating")
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
        this.#bindings.count("adapterSubscriptions")
        try {
            runExternalCallback(
                domain,
                new SelectorEvaluationSession(),
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
                        this.#bindings.count("thenableContainments")
                        containThenable(inspected)
                        throw new InvalidExternalCleanupError()
                    }
                    if (typeof returned !== "function")
                        throw new InvalidExternalCleanupError()
                    generation.cleanup = returned as () => unknown
                },
                generation,
            )
            this.#dirty.delete(generation)
            const sampled = this.#sample(
                projection.node,
                new SelectorEvaluationSession(),
            )
            this.#publish(projection.node, sampled)
            projection.status = "active"
            projection.scopes.forEach(scope => {
                if (scope.status === "live")
                    scope.refreshExternalActivity(projection.node)
            })
            this.#unattached.delete(projection)
        } catch (error) {
            this.failure(error, "admitting")
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

    #completionError(thrown: unknown): unknown {
        const inspected = inspectThenable(thrown)
        if (inspected.kind === "inspection-error") return inspected.error
        if (inspected.kind === "thenable") {
            this.#bindings.count("thenableContainments")
            containThenable(inspected)
            return new InvalidExternalCleanupError()
        }
        return thrown
    }

    #cleanup(projection: Projection): void {
        const previousPhase = this.#operation?.phase
        this.phase("cleanup")
        const cleanup = this.#revoke(projection)
        projection.status = "detaching"
        if (cleanup !== undefined) {
            this.#bindings.count("adapterCleanups")
            const previous = this.#operation!.source
            this.#operation!.source = "external-cleanup"
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
                            this.#bindings.count("thenableContainments")
                            containThenable(inspected)
                            throw new InvalidExternalCleanupError()
                        }
                    },
                )
            } catch (error) {
                this.failure(error, "cleanup")
            } finally {
                this.#operation!.source = previous
            }
        }
        projection.status = "dormant"
        projection.scopes.forEach(scope => {
            if (scope.status === "live")
                scope.refreshExternalActivity(projection.node)
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
            this.#dirty.add(generation)
            return
        }
        if (activity !== undefined && activity.kind !== "subscriber") {
            const error = new CallbackCapabilityError()
            throw error
        }
        if (this.#operation?.terminal) return
        if (this.#operation !== undefined) {
            this.#dirty.add(generation)
            return
        }
        const delivery = this.#delivery
        if (delivery.depth === 0) delivery.work = 0
        if (
            delivery.depth >= this.#bounds.deliveryDepth ||
            delivery.work >= this.#bounds.deliveryWork
        ) {
            projection.retryRequired = true
            this.#bindings.count("deliveryLimitHits")
            throw new ExternalSourceDeliveryLimitError()
        }
        delivery.depth++
        delivery.work++
        this.#bindings.count("deliveryEntries")
        delete projection.retryRequired
        try {
            this.run("external-invalidation", () => {
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
            this.#bindings.count("dirtyRounds")
            frame.source =
                rounds === 1 && frame.source === "external-invalidation"
                    ? "external-invalidation"
                    : "external-drain"
            frame.phase = "drainingExternal"
            const outcomes: [
                Projection,
                ServedSelectorOutcome<OutcomeToken>["outcome"],
            ][] = []
            const sampleFailures: unknown[] = []
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
                this.#bindings.count("dirtySamples")
                try {
                    outcomes.push([
                        projection,
                        this.#sample(
                            projection.node,
                            new SelectorEvaluationSession(),
                        ),
                    ])
                } catch (error) {
                    outcomes.push([
                        projection,
                        Object.freeze({ kind: "control-error", error }),
                    ])
                    sampleFailures.push(error)
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
        sampleFailures: readonly unknown[] = [],
    ): void {
        const previous = this.#pull
        this.#pull = this.#newPull(false)
        this.#pull.epochAdvanced = false
        try {
            this.#bindings.settleRead(() => {
                for (const [projection, outcome] of outcomes)
                    this.#publish(projection.node, outcome)
                for (const error of sampleFailures)
                    this.failure(error, "sampling")
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
        sampleFailures: readonly unknown[] = [],
    ): void {
        this.#operation!.terminal = true
        const error = new ExternalSourceNonConvergenceError()
        this.#bindings.count("nonConvergenceTerminations")
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
        this.#round(outcomes, [...sampleFailures, error])
        this.#flushReleases()
        this.#dirty.clear()
    }
    get dormantPull(): boolean {
        return this.#pull?.dormant === true
    }
    get operating(): boolean {
        return this.#operation !== undefined
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
    installed(node: AnyState): ServedSelectorOutcome<OutcomeToken> | undefined {
        return this.#projections.get(node)?.served
    }
    current(scope: StoreScopeNode, node: AnyState): boolean {
        return (
            this.active(node) ||
            (!scope.reachesDormantExternal(node) &&
                scope.getMaterializedServedOutcome(node) !== undefined)
        )
    }
    get changedPull(): boolean {
        return this.#pull?.epochAdvanced === true
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
            if (scope.reachesExternal(dependency.node))
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
            this.#bindings.count("lifecycleEdgeVisits")
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
                    this.#bindings.count("lifecycleRetains")
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
            this.#bindings.count("lifecycleEdgeVisits")
            if (--record.count !== 0) continue
            if (this.#bindings.domain.externalAtoms!.has(current)) {
                const projection = this.#projections.get(current)!
                if (--projection.retains === 0) {
                    this.#bindings.count("lifecycleReleases")
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
        if (!scope.reachesExternal(node)) return
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
            scope.reachesExternal(node)
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
    ): void {
        if (!this.#pull?.dormant) return
        const byScope = (this.#pull.selectorFaults ??= new WeakMap())
        let faults = byScope.get(scope)
        if (faults === undefined) byScope.set(scope, (faults = new Map()))
        faults.set(node, error)
    }

    rethrowSelectorFault(
        scope: StoreScopeNode,
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): void {
        const faults = this.#pull?.selectorFaults?.get(scope)
        if (!faults?.has(node)) return
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
        let served: ServedSelectorOutcome<OutcomeToken> | undefined
        try {
            this.#bindings.settleRead(() => {
                this.refresh(scope, node, session)
                served = scope.serveKnownLocal(node, session)
            })
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
        if (!scope.reachesExternal(node)) return
        if (!scope.reachesDormantExternal(node)) return
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
            this.#bindings.count("externalClosureVisits")
            const dependencies =
                scope.getCommittedSelectorDependencies(current as never) ?? []
            for (let index = dependencies.length - 1; index >= 0; index--) {
                const dependency = dependencies[index]!.node
                if (scope.reachesExternal(dependency)) pending.push(dependency)
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
        this.#bindings.count("externalClosureVisits")
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
        this.#bindings.count("liveSamples")
        const previous = this.#operation?.phase
        this.phase("samplingExternal")
        try {
            return sampleExternal(
                this.#bindings.domain,
                this.#bindings.domain.externalAtoms!.get(node)!,
                session,
                undefined,
                () => this.#bindings.count("thenableContainments"),
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
            previous?.outcome.kind === outcome.kind &&
            (outcome.kind === "value"
                ? Object.is(
                      (previous.outcome as { value: unknown }).value,
                      outcome.value,
                  )
                : Object.is(
                      (previous.outcome as { error: unknown }).error,
                      outcome.error,
                  ))
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
                        this.#bindings.count("deadRouteCompactions"),
                    ),
                }
                this.#projections.set(node, projection)
            } else projection.served = served
            this.#bindings.count("projectionPublications")
            if (previous !== undefined && this.#pull?.epochAdvanced === false) {
                this.#pull.epochAdvanced = true
                this.#bindings.advanceEpoch()
            }
        }
        const served = projection!.served
        this.#pull?.samples.set(node, served)
        if (previous !== undefined && previous !== served) {
            projection!.scopes.forEach(route => {
                this.#bindings.count("routeVisits")
                if (route.status === "live") this.#bindings.reach(route, node)
            })
        }
        return served
    }
}
