import type {
    SelectorEvaluationSession,
    ServedSelectorOutcome,
} from "../selector-evaluator/types"
import type { AnyState } from "./runtime-domain"
import {
    WeakHandleSet,
    type OutcomeToken,
    type StoreScopeNode,
} from "./scope-node"
import { DormantExternalReadError, sampleExternal } from "./external-atom"
import type { ExternalTreeBindings, ExternalTreePlane } from "./external-types"

interface Projection {
    served: ServedSelectorOutcome<OutcomeToken>
    readonly scopes: WeakHandleSet<StoreScopeNode>
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
    #pull: Pull | undefined

    constructor(bindings: ExternalTreeBindings) {
        this.#bindings = bindings
    }
    get dormantPull(): boolean {
        return this.#pull?.dormant === true
    }
    get changedPull(): boolean {
        return this.#pull?.epochAdvanced === true
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
        this.#rejectSubscriberRead(session)
        const pull = this.#pull
        if (pull === undefined) return
        let visited = pull.refreshed.get(scope)
        if (visited === undefined)
            pull.refreshed.set(scope, (visited = new WeakSet()))
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
        this.#bindings.count("liveSamples")
        let outcome: import("./runtime-domain").SynchronousResult
        try {
            outcome = sampleExternal(
                this.#bindings.domain,
                this.#bindings.domain.externalAtoms!.get(node)!,
                session,
                undefined,
                () => this.#bindings.count("thenableContainments"),
            )
        } catch (error) {
            if (this.#pull !== undefined)
                (this.#pull.faults ??= new Map()).set(node, error)
            throw error
        }
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
                    served,
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
        projection!.scopes.add(scope)
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
