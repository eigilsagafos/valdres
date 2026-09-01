import type {
    SelectorComparisonBaseline,
    SelectorDefinition,
    SelectorDependencySnapshot,
    SelectorEvaluationHost,
    SelectorEvaluationProposal,
    SelectorRecordView,
    ServedSelectorOutcome,
} from "../selector-evaluator/types"
import { SelectorEvaluationSession } from "../selector-evaluator/types"
import {
    classifyOwner,
    REACQUIRABLE_ATOMS,
    runSelectorActivity,
    type AnyAtom,
    type AnyState,
    type RuntimeDomainRecords,
} from "./runtime-domain"
import type { DraftAtomOutcome } from "./tree-transaction"
import type { Selector } from "./types"

export type AnySelector = Selector<any>
export type OutcomeToken = Readonly<{ id: number }>
export type StoreTreeCounter =
    | "sourceEpoch"
    | "routeVisits"
    | "deadRouteCompactions"
    | "scratchHostAllocations"
    | "propagationSettlements"
    | "disposalVisits"
    | "warmParentHops"
    | "scopeNodesCreated"
    | "storeFacadesCreated"
    | "namedScopeHits"
    | "namedScopeMisses"
    | "routeAdds"
    | "routeRemoves"
    | "fallbackPublications"
    | "draftCreations"
    | "scratchMapAllocations"
    | "finalResolutionVisits"
    | "finalPreflightVisits"
    | "draftStorageAllocations"
    | "commitWorksetAllocations"
    | "subscriptionIndexMapsCreated"
    | "subscriptionTargetsCreated"
    | "subscriptionRegistrations"
    | "subscriptionRemovals"
    | "unsubscribeClosuresCreated"
    | "activeSubscriptionScopes"
    | "activeSubscriptionTargets"
    | "activeSubscriptions"
    | "notificationTargetsReached"
    | "notificationSnapshots"
    | "subscriberCallbacksAttempted"
    | "subscriberErrors"
    | "familyOwnerRetentionSetsCreated"
    | "familyOwnerRetains"
    | "familyOwnerReleases"

interface SelectorRecord {
    readonly served: ServedSelectorOutcome<OutcomeToken>
    readonly dependencies: readonly SelectorDependencySnapshot<
        AnyState,
        OutcomeToken
    >[]
    readonly lastSuccess:
        | Readonly<{ value: unknown; token: OutcomeToken }>
        | undefined
}

export interface AtomViewRecord {
    readonly scope: StoreScopeNode
    readonly atom: AnyAtom
    served: ServedSelectorOutcome<OutcomeToken>
    inheritedFrom: AtomViewRecord | undefined
    readonly inheritingChildren: WeakHandleSet<AtomViewRecord>
}

export interface StoreScopeCoordinator {
    readonly runtimeDomain: RuntimeDomainRecords
    readonly postSourceApply: boolean
    readonly instrumented: boolean
    evaluate<Value>(
        definition: SelectorDefinition<AnyState, Value>,
        host: SelectorEvaluationHost<AnyState, OutcomeToken>,
        session: SelectorEvaluationSession<AnyState>,
    ): SelectorEvaluationProposal<AnyState, OutcomeToken, Value>

    createOutcomeToken(): OutcomeToken
    serveScopeAtom(
        scope: StoreScopeNode,
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken>
    enqueueSelector(scope: StoreScopeNode, selector: AnySelector): boolean
    prepareSelectorRead(scope: StoreScopeNode, selector: AnySelector): void
    reachSubscriptionTarget(scope: StoreScopeNode, state: AnyState): void
    latchPropagationControlFault(error: unknown): void
    recordCounter(counter: StoreTreeCounter, amount?: number): void
}

/**
 * Weak, explicitly removable routing handles. Correctness never depends on a
 * finalizer; dead handles are compacted whenever the set is traversed.
 */
export class WeakHandleSet<Value extends object> {
    #byValue = new WeakMap<Value, WeakRef<Value>>()
    readonly #references = new Set<WeakRef<Value>>()

    constructor(
        readonly onDeadReference?: () => void,
        readonly onEmptinessProbe?: () => void,
    ) {}

    add(value: Value): void {
        if (this.#byValue.has(value)) return
        const reference = new WeakRef(value)
        this.#byValue.set(value, reference)
        this.#references.add(reference)
    }

    delete(value: Value): void {
        const reference = this.#byValue.get(value)
        if (reference === undefined) return
        this.#byValue.delete(value)
        this.#references.delete(reference)
    }

    forEach(visitor: (value: Value) => void): void {
        for (const reference of this.#references) {
            const value = reference.deref()
            if (value === undefined) {
                this.#references.delete(reference)
                this.onDeadReference?.()
                continue
            }
            visitor(value)
        }
    }

    isEmpty(): boolean {
        for (const reference of this.#references) {
            this.onEmptinessProbe?.()
            if (reference.deref() !== undefined) return false
            this.#references.delete(reference)
            this.onDeadReference?.()
        }
        return true
    }

    clear(): void {
        this.#references.clear()
        this.#byValue = new WeakMap()
    }
}

/**
 * Persistent ownership and inheritance stay scope-qualified:
 *
 *     named parent --strong name--> child generation
 *     any parent   --weak route---> anonymous/named child
 *     AtomView     --weak route---> inheriting AtomView
 *     scope        --weak key-----> Atom/Selector records
 *     scope        --strong pin---> owned family Atom override
 *
 * Only the named identity table owns children. Weak route indexes are routing
 * accelerators, so abandoned anonymous scopes and State records remain GC-able.
 * The private family pin mirrors only an owned Atom override; it is never
 * family membership or an enumerable State index.
 */
export class StoreScopeNode
    implements SelectorEvaluationHost<AnyState, OutcomeToken>
{
    readonly coordinator: StoreScopeCoordinator
    readonly parent: StoreScopeNode | undefined
    readonly name: string | undefined
    readonly children: WeakHandleSet<StoreScopeNode>
    readonly namedChildren = new Map<string, StoreScopeNode>()
    atomOverrides = new WeakMap<AnyAtom, unknown>();
    [REACQUIRABLE_ATOMS] = undefined as Set<AnyAtom> | undefined

    #atomViews = new WeakMap<AnyAtom, AtomViewRecord>()
    readonly #liveAtomViews: WeakHandleSet<AtomViewRecord>
    #selectorRecords = new WeakMap<AnySelector, SelectorRecord>()
    #selectorDependencyNodes:
        | WeakMap<AnySelector, readonly AnySelector[]>
        | undefined
    #reverseEdges = new WeakMap<AnyState, WeakHandleSet<AnySelector>>()
    #dirtySelectors = new WeakSet<AnySelector>()
    #selectorGraphVersion = 0
    #facade: object | undefined
    #status: "live" | "disposing" | "disposed" = "live"

    constructor(
        coordinator: StoreScopeCoordinator,
        parent?: StoreScopeNode,
        name?: string,
    ) {
        this.coordinator = coordinator
        this.parent = parent
        this.name = name
        this.children = this.#weakRoutes()
        this.#liveAtomViews = this.#weakRoutes<AtomViewRecord>()
    }

    get status(): "live" | "disposing" | "disposed" {
        return this.#status
    }

    get facade(): object {
        if (this.#facade === undefined) {
            throw new Error("Store scope facade is not installed")
        }
        return this.#facade
    }

    installFacade(facade: object): void {
        if (this.#facade !== undefined) {
            throw new Error("Store scope facade is already installed")
        }
        this.#facade = facade
    }

    markDisposing(): void {
        if (this.#status === "live") this.#status = "disposing"
    }

    markDisposed(): void {
        this.#status = "disposed"
    }

    getAtomView(atom: AnyAtom): AtomViewRecord | undefined {
        return this.#atomViews.get(atom)
    }

    getMaterializedServedOutcome(
        state: AnyState,
    ): ServedSelectorOutcome<OutcomeToken> | undefined {
        const atomView = this.#atomViews.get(state as AnyAtom)
        if (atomView !== undefined) return atomView.served
        const selector = state as AnySelector
        const selectorRecord = this.#selectorRecords.get(selector)
        return selectorRecord !== undefined &&
            !this.#dirtySelectors.has(selector)
            ? selectorRecord.served
            : undefined
    }

    createAtomView(
        atom: AnyAtom,
        outcome: DraftAtomOutcome,
        inheritedFrom?: AtomViewRecord,
    ): AtomViewRecord {
        const current = this.#atomViews.get(atom)
        if (current !== undefined) return current
        const record: AtomViewRecord = {
            scope: this,
            atom,
            served: Object.freeze({
                token: this.createOutcomeToken(),
                outcome,
            }),
            inheritedFrom,
            inheritingChildren: this.#weakRoutes(),
        }
        this.#atomViews.set(atom, record)
        this.#liveAtomViews.add(record)
        if (inheritedFrom !== undefined) {
            inheritedFrom.inheritingChildren.add(record)
            this.coordinator.recordCounter("routeAdds")
        }
        return record
    }

    attachAtomView(
        record: AtomViewRecord,
        inheritedFrom: AtomViewRecord,
    ): void {
        if (Object.is(record.inheritedFrom, inheritedFrom)) return
        this.detachAtomView(record)
        record.inheritedFrom = inheritedFrom
        inheritedFrom.inheritingChildren.add(record)
        this.coordinator.recordCounter("routeAdds")
    }

    detachAtomView(record: AtomViewRecord): void {
        if (record.inheritedFrom === undefined) return
        record.inheritedFrom.inheritingChildren.delete(record)
        record.inheritedFrom = undefined
        this.coordinator.recordCounter("routeRemoves")
    }

    updateAtomView(record: AtomViewRecord, outcome: DraftAtomOutcome): void {
        record.served = Object.freeze({
            token: this.createOutcomeToken(),
            outcome,
        })
        this.coordinator.reachSubscriptionTarget(this, record.atom)
    }

    captureCommittedSelectorSuccess(
        selector: AnySelector,
    ): Readonly<{ value: unknown }> | undefined {
        const lastSuccess = this.#selectorRecords.get(selector)?.lastSuccess
        return lastSuccess === undefined
            ? undefined
            : Object.freeze({ value: lastSuccess.value })
    }

    isSelectorDirty(selector: AnySelector): boolean {
        return this.#dirtySelectors.has(selector)
    }

    getCommittedSelectorDependencies(
        selector: AnySelector,
    ):
        | readonly SelectorDependencySnapshot<AnyState, OutcomeToken>[]
        | undefined {
        return this.#selectorRecords.get(selector)?.dependencies
    }

    markDependents(node: AnyState): void {
        this.#reverseEdges.get(node)?.forEach(selector => {
            if (this.coordinator.enqueueSelector(this, selector)) {
                this.#dirtySelectors.add(selector)
            }
        })
    }

    dropRecords(): void {
        this.#liveAtomViews.forEach(record => {
            this.detachAtomView(record)
            record.inheritingChildren.clear()
        })
        this.#liveAtomViews.clear()
        this.atomOverrides = new WeakMap()
        const retainedFamilyAtoms = this[REACQUIRABLE_ATOMS]?.size ?? 0
        if (retainedFamilyAtoms > 0) {
            this.coordinator.recordCounter(
                "familyOwnerReleases",
                retainedFamilyAtoms,
            )
        }
        this[REACQUIRABLE_ATOMS] = undefined
        this.#atomViews = new WeakMap()
        this.#selectorRecords = new WeakMap()
        this.#selectorDependencyNodes = undefined
        this.#reverseEdges = new WeakMap()
        this.#dirtySelectors = new WeakSet()
    }

    serve(
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken> {
        const domain = this.coordinator.runtimeDomain
        if (classifyOwner(domain, node, session) === "invalid") {
            throw new TypeError("Selector get requires a valid State")
        }
        return this.serveKnownLocal(node, session)
    }

    serveKnownLocal(
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken> {
        const domain = this.coordinator.runtimeDomain
        if (domain.atoms.has(node)) {
            const current = this.#atomViews.get(node as AnyAtom)
            if (current !== undefined) return current.served
            return this.coordinator.serveScopeAtom(
                this,
                node as AnyAtom,
                session,
            )
        }

        const definition = domain.selectors.get(node)
        if (definition === undefined) {
            throw new TypeError("Unknown committed StoreTree state")
        }
        const selector = node as AnySelector
        let current = this.#selectorRecords.get(selector)
        if (current !== undefined && this.coordinator.postSourceApply) {
            this.coordinator.prepareSelectorRead(this, selector)
            current = this.#selectorRecords.get(selector)
        }
        if (current !== undefined && !this.#dirtySelectors.has(selector)) {
            return current.served
        }

        const proposal = runSelectorActivity(domain, session, () =>
            this.coordinator.evaluate(definition, this, session),
        )
        if (
            proposal.outcome.kind === "control-error" &&
            !this.coordinator.postSourceApply
        ) {
            throw proposal.outcome.error
        }
        return this.#installSelectorProposal(selector, proposal, session)
    }

    getSelectorRecord(
        node: AnyState,
    ): SelectorRecordView<AnyState, OutcomeToken> | undefined {
        const record = this.#selectorRecords.get(node as AnySelector)
        return record === undefined
            ? undefined
            : Object.freeze({ dependencies: record.dependencies })
    }

    getSelectorDependencyNodes(
        node: AnyState,
    ): readonly AnySelector[] | undefined {
        const record = this.#selectorRecords.get(node as AnySelector)
        if (record === undefined) return undefined
        const selector = node as AnySelector
        let selectorDependencyNodes =
            this.#selectorDependencyNodes?.get(selector)
        if (selectorDependencyNodes === undefined) {
            const filtered: AnySelector[] = []
            for (const dependency of record.dependencies) {
                if (
                    this.coordinator.runtimeDomain.selectors.has(
                        dependency.node,
                    )
                ) {
                    filtered.push(dependency.node as AnySelector)
                }
            }
            selectorDependencyNodes = Object.freeze(filtered)
            let cache = this.#selectorDependencyNodes
            if (cache === undefined) {
                cache = new WeakMap()
                this.#selectorDependencyNodes = cache
            }
            cache.set(selector, selectorDependencyNodes)
        }
        return selectorDependencyNodes
    }

    getSelectorGraphVersion(): number {
        return this.#selectorGraphVersion
    }

    getComparisonBaseline(
        node: AnyState,
    ): SelectorComparisonBaseline<OutcomeToken> | undefined {
        const record = this.#selectorRecords.get(node as AnySelector)
        if (record?.lastSuccess === undefined) return undefined
        return record.served.outcome.kind === "value"
            ? Object.freeze({
                  current: true as const,
                  value: record.lastSuccess.value,
                  token: record.served.token,
              })
            : Object.freeze({
                  current: false as const,
                  value: record.lastSuccess.value,
              })
    }

    createOutcomeToken(): OutcomeToken {
        return this.coordinator.createOutcomeToken()
    }

    #installSelectorProposal(
        selector: AnySelector,
        proposal: SelectorEvaluationProposal<AnyState, OutcomeToken>,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken> {
        const previous = this.#selectorRecords.get(selector)
        const served = Object.freeze({
            token: proposal.token,
            outcome: proposal.outcome,
        })
        const record: SelectorRecord = Object.freeze({
            served,
            dependencies: proposal.dependencies,
            lastSuccess:
                proposal.outcome.kind === "value"
                    ? Object.freeze({
                          value: proposal.outcome.value,
                          token: proposal.token,
                      })
                    : previous?.lastSuccess,
        })

        const topologyChanged = this.#replaceReverseEdges(
            selector,
            previous?.dependencies ?? EMPTY_DEPENDENCIES,
            proposal.dependencies,
        )
        if (topologyChanged) this.#selectorDependencyNodes?.delete(selector)
        this.#selectorGraphVersion++
        session.noteSelectorGraphPublication(this)
        this.#selectorRecords.set(selector, record)
        this.#dirtySelectors.delete(selector)

        if (
            previous !== undefined &&
            !Object.is(previous.served.token, proposal.token)
        ) {
            this.coordinator.reachSubscriptionTarget(this, selector)
            this.markDependents(selector)
        }
        if (proposal.outcome.kind === "control-error") {
            this.coordinator.latchPropagationControlFault(
                proposal.outcome.error,
            )
        }
        return served
    }

    #replaceReverseEdges(
        selector: AnySelector,
        previous: readonly SelectorDependencySnapshot<AnyState, OutcomeToken>[],
        next: readonly SelectorDependencySnapshot<AnyState, OutcomeToken>[],
    ): boolean {
        if (previous.length === next.length) {
            let index = 0
            while (
                index < previous.length &&
                Object.is(previous[index]!.node, next[index]!.node)
            ) {
                index++
            }
            if (index === previous.length) return false
        }

        for (const dependency of previous) {
            const dependents = this.#reverseEdges.get(dependency.node)
            dependents?.delete(selector)
            if (dependents?.isEmpty()) {
                this.#reverseEdges.delete(dependency.node)
            }
        }
        for (const dependency of next) {
            let dependents = this.#reverseEdges.get(dependency.node)
            if (dependents === undefined) {
                dependents = this.#weakRoutes()
                this.#reverseEdges.set(dependency.node, dependents)
            }
            dependents.add(selector)
        }
        return true
    }

    #weakRoutes<Value extends object>(): WeakHandleSet<Value> {
        return new WeakHandleSet(
            this.coordinator.instrumented
                ? () => this.coordinator.recordCounter("deadRouteCompactions")
                : undefined,
        )
    }
}

const EMPTY_DEPENDENCIES = Object.freeze(
    [],
) as readonly SelectorDependencySnapshot<AnyState, OutcomeToken>[]
