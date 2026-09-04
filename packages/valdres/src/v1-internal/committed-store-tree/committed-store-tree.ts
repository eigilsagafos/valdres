import type {
    SelectorDefinition,
    SelectorEvaluationStrategy,
    ServedSelectorOutcome,
} from "../selector-evaluator/types"
import { evaluateSelector } from "../selector-evaluator/evaluate"
import { SelectorEvaluationSession } from "../selector-evaluator/types"
import {
    CallbackCapabilityError,
    COLLECTION_KERNEL,
    InvalidAtomComparatorResultError,
    InvalidSynchronousAtomValueError,
    InvalidTransactionCallbackResultError,
    InvalidTransactionTargetError,
    DEFINITION_CALLBACK_FRAME,
    FAMILY_DEFINITIONS,
    RuntimeMismatchError,
    REACQUIRABLE_ATOMS,
    ScopeNotFoundError,
    SelectorCapabilityError,
    StoreDisposedError,
    StoreTreeMismatchError,
    TransactionClosedError,
    TransactionPhaseError,
    SubscriberNotificationError,
    assertRuntimeDefinitionConstructionAllowed,
    assertCursorOperationAllowed,
    assertStoreReadAllowed,
    assertStoreOperationAllowed,
    assertUnsubscribeAllowed,
    brandRuntimeHandle,
    classifyEntryOwner,
    classifyOwner,
    containThenable,
    inspectSynchronousAtomValue,
    inspectThenable,
    makeStateHandle,
    registerRuntimeStateHandle,
    rejectGuardedSelectorRead,
    runGuardedCallback,
    runLazyInitializer,
    runSelectorActivity,
    runSubscriberActivity,
    runTransactionActivity,
    runTransactionResultActivity,
    type AnyAtom,
    type AnyState,
    type AtomDefinition,
    type CollectionCommitPlan,
    type CollectionMutationKind,
    type DefinitionState,
    type OptionalCollectionVTable,
    type RuntimeDomainRecords,
    type SynchronousResult,
} from "./runtime-domain"
import {
    ScratchSelectorHost,
    type ResolvedScratchState,
    type ScratchSourceKind,
} from "./scratch-selector-host"
import {
    StoreScopeNode,
    type AtomViewRecord,
    type AnySelector,
    type OutcomeToken,
    type StoreScopeCoordinator,
    type StoreTreeCounter,
} from "./scope-node"
import {
    TreeDraft,
    createRootTransactionCursor,
    inspectTransactionCallbackResult,
    rethrowTransactionCallbackThrow,
    type AtomDraftBaseline,
    type AtomIntent,
    type DraftAtomOutcome,
    type TreeTransactionHost,
} from "./tree-transaction"
import type {
    Atom,
    AtomOptions,
    CommittedStoreTree,
    CommittedStoreTreeAdapter,
    CommittedStoreTreeDomain,
    CollectionRow,
    RootTransaction,
    Selector,
    SelectorOptions,
    State,
    StateRead,
    TransactionCallback,
} from "./types"

interface AtomApplyPlan {
    readonly scope: StoreScopeNode
    readonly intent: AtomIntent
    readonly ownershipChanged: boolean
}

interface CommitWorksets {
    readonly onAllocation: (() => void) | undefined
    preflightAtom: AnyAtom | undefined
    preflightScope: StoreScopeNode | undefined
    preflightOutcome: DraftAtomOutcome | undefined
    secondPreflightAtom: AnyAtom | undefined
    secondPreflightScope: StoreScopeNode | undefined
    secondPreflightOutcome: DraftAtomOutcome | undefined
    preflight: Map<AnyAtom, Map<StoreScopeNode, DraftAtomOutcome>> | undefined
    consideredRecord: AtomViewRecord | undefined
    secondConsideredRecord: AtomViewRecord | undefined
    considered: Set<AtomViewRecord> | undefined
    affectedRecord: AtomViewRecord | undefined
    affectedBefore: DraftAtomOutcome | undefined
    secondAffectedRecord: AtomViewRecord | undefined
    secondAffectedBefore: DraftAtomOutcome | undefined
    affected: Map<AtomViewRecord, DraftAtomOutcome> | undefined
}

type SubscriberCallback = () => unknown

interface SubscriptionTarget {
    readonly host: CommittedStoreTreeHost
    readonly scope: StoreScopeNode
    readonly state: AnyState
    head: SubscriptionRegistration | undefined
    tail: SubscriptionRegistration | undefined
    reachedEpoch: number
}

interface SubscriptionRegistration {
    callback: SubscriberCallback | undefined
    target: SubscriptionTarget | undefined
    previous: SubscriptionRegistration | undefined
    next: SubscriptionRegistration | undefined
}

const createUnsubscribe = (
    registration: SubscriptionRegistration,
): (() => void) =>
    function unsubscribe(): void {
        const target = registration.target
        if (target === undefined) return
        target.host.removeSubscription(registration)
    }

export interface InternalStoreTreeInstrumentation {
    read(counter: StoreTreeCounter): number
}

/** @internal Construction-time inspect seam. Ordinary StoreTrees omit it. */
export type InternalStoreTreeTrace = ((
    code: number,
    first?: unknown,
    second?: unknown,
    third?: unknown,
) => void) & {
    readonly evaluate?: SelectorEvaluationStrategy
}

/** Internal domain surface used by the singleton public runtime. A domain-level
 * instrumentation remains the default for the existing architecture harnesses,
 * while one StoreTree may select its own instrumentation without creating a
 * second runtime domain (and therefore without changing State ownership). */
const definitionDomainRecords = Symbol("definition domain records")

export interface InternalCommittedStoreTreeDomain
    extends CommittedStoreTreeDomain {
    readonly [definitionDomainRecords]: RuntimeDomainRecords
    createStoreTree(
        instrumentation?: InternalStoreTreeInstrumentation,
        trace?: InternalStoreTreeTrace,
    ): CommittedStoreTree
}

/** @internal Stable identity shared by every facade over one runtime record. */
export const getDefinitionDomainIdentity = (
    domain: InternalCommittedStoreTreeDomain,
): object => domain[definitionDomainRecords].ownerToken

/** @internal Installs one optional collection implementation after its
 * tree-shakeable factory has completed successfully. */
export const ensureCollectionKernel = <Kernel extends OptionalCollectionVTable>(
    domain: InternalCommittedStoreTreeDomain,
    create: (records: RuntimeDomainRecords) => Kernel,
): Kernel => {
    const records = domain[definitionDomainRecords]
    const current = records[COLLECTION_KERNEL]
    if (current !== undefined) return current as Kernel
    const created = create(records)
    records[COLLECTION_KERNEL] = created
    return created
}

/** @internal Read-only probe used by optional integration and focused tests. */
export const getCollectionKernel = (
    domain: InternalCommittedStoreTreeDomain,
): OptionalCollectionVTable | undefined =>
    domain[definitionDomainRecords][COLLECTION_KERNEL]

export type DefinitionCallbackPhase =
    | "factory"
    | "encoder"
    | "family-encoder"
    | "collection-encoder"

/** @internal Definition-only callback quarantine for identity helpers. */
export const runDefinitionCallback = <Result, Validated = Result>(
    domain: InternalCommittedStoreTreeDomain,
    phase: DefinitionCallbackPhase,
    callback: (...args: any[]) => Result,
    args: ArrayLike<unknown>,
    validate?: (result: Result) => Validated,
    createAccessorFault?: () => TypeError,
): Validated => {
    const records = domain[definitionDomainRecords]
    const session = new SelectorEvaluationSession<AnyState>()
    const currentActivity = records.activity
    let selectorActivity =
        currentActivity?.kind === "selector"
            ? currentActivity
            : currentActivity?.kind === "guarded-callback"
              ? currentActivity.selectorActivity
              : undefined
    const selectorSessions: SelectorEvaluationSession<AnyState>[] = []
    while (selectorActivity !== undefined) {
        const selectorSession =
            selectorActivity.session as SelectorEvaluationSession<AnyState>
        if (!selectorSessions.includes(selectorSession)) {
            selectorSessions.push(selectorSession)
        }
        selectorActivity = selectorActivity.parentSelectorActivity
    }
    const previous = records[DEFINITION_CALLBACK_FRAME]
    records[DEFINITION_CALLBACK_FRAME] = {
        session,
        definitions: new WeakSet(),
        allowDefinitions: phase === "factory",
        ...(createAccessorFault === undefined ? {} : { createAccessorFault }),
    }
    const previousReadGuards = selectorSessions.map(selectorSession =>
        Object.freeze({
            selectorSession,
            previous: selectorSession.setSuppliedReadGuard((): never => {
                const activity = records.activity
                return rejectGuardedSelectorRead(
                    activity?.kind === "guarded-callback"
                        ? activity.session
                        : session,
                    selectorSession,
                )
            }),
        }),
    )
    try {
        return runGuardedCallback(records, session, () => {
            const result = Reflect.apply(callback, undefined, args)
            return validate === undefined
                ? (result as unknown as Validated)
                : validate(result)
        })
    } finally {
        for (let index = previousReadGuards.length - 1; index >= 0; index--) {
            const guard = previousReadGuards[index]!
            guard.selectorSession.setSuppliedReadGuard(guard.previous)
        }
        if (previous === undefined) {
            delete records[DEFINITION_CALLBACK_FRAME]
        } else {
            records[DEFINITION_CALLBACK_FRAME] = previous
        }
    }
}

/** @internal Rejects accessor work reached from a pure definition encoder.
 * Collection injects one lazy TypeError factory per frame; the existing family
 * path omits it and therefore preserves CallbackCapabilityError semantics. */
export const assertDefinitionAccessorCallAllowed = (
    domain: InternalCommittedStoreTreeDomain,
): void => {
    const frame = domain[definitionDomainRecords][DEFINITION_CALLBACK_FRAME]
    if (frame === undefined || frame.allowDefinitions) return
    const controlFault = frame.session.getControlFault()
    if (controlFault.kind === "fault") throw controlFault.error
    const error =
        frame.createAccessorFault === undefined
            ? new CallbackCapabilityError()
            : (frame.accessorFault ??= frame.createAccessorFault())
    frame.session.latchControlFault(error)
    throw error
}

/** @internal Rejects definition construction before option/value validation in
 * encoder callbacks while preserving the first exact latched control fault. */
export const assertDefinitionConstructionAllowed = (
    domain: InternalCommittedStoreTreeDomain,
): void =>
    assertRuntimeDefinitionConstructionAllowed(domain[definitionDomainRecords])

/** @internal Compatibility name retained for the already-published family
 * composition. */
export const assertDefinitionFamilyCallAllowed =
    assertDefinitionAccessorCallAllowed

/** @internal Brand and register an arbitrary mutable definition handle. */
export const registerDefinitionHandle = <Handle extends object>(
    domain: InternalCommittedStoreTreeDomain,
    mutableHandle: Handle,
): Readonly<Handle> =>
    registerRuntimeStateHandle(domain[definitionDomainRecords], mutableHandle)

/** @internal Neutral owner classification for optional definition modules.
 * Callers still prove their own kind through their module-local registry. */
export const classifyDefinitionHandleOwner = (
    domain: InternalCommittedStoreTreeDomain,
    value: unknown,
): "local" | "invalid" =>
    classifyEntryOwner(
        domain[definitionDomainRecords],
        value,
        new SelectorEvaluationSession<AnyState>(),
    )

/** @internal Exact same-domain State admission for definition helpers. */
export const assertDefinitionState = (
    domain: InternalCommittedStoreTreeDomain,
    value: unknown,
): DefinitionState | undefined => {
    const records = domain[definitionDomainRecords]
    if (
        (typeof value === "object" || typeof value === "function") &&
        value !== null &&
        records.states.has(value) &&
        (records.atoms.has(value) || records.selectors.has(value))
    ) {
        const frame = records[DEFINITION_CALLBACK_FRAME]
        if (
            frame?.definitions.has(value) ||
            records[FAMILY_DEFINITIONS]?.has(value)
        ) {
            return value as DefinitionState
        }
        return undefined
    }

    classifyEntryOwner(
        records,
        value,
        new SelectorEvaluationSession<AnyState>(),
    )
    return undefined
}

/** @internal Marks successful family members and only their Atoms as reacquirable. */
export const markReacquirableDefinitionState = (
    domain: InternalCommittedStoreTreeDomain,
    state: DefinitionState,
): void => {
    const records = domain[definitionDomainRecords]
    const definitions =
        records[FAMILY_DEFINITIONS] ??
        (records[FAMILY_DEFINITIONS] = new WeakSet())
    definitions.add(state)
    if (!records.atoms.has(state)) return
    const reacquirable =
        records[REACQUIRABLE_ATOMS] ??
        (records[REACQUIRABLE_ATOMS] = new WeakSet())
    reacquirable.add(state)
}

const STORE_TREE_COUNTER_INDEX: Readonly<Record<StoreTreeCounter, number>> =
    Object.freeze({
        sourceEpoch: 0,
        routeVisits: 1,
        deadRouteCompactions: 2,
        scratchHostAllocations: 3,
        propagationSettlements: 4,
        disposalVisits: 5,
        warmParentHops: 6,
        scopeNodesCreated: 7,
        storeFacadesCreated: 8,
        namedScopeHits: 9,
        namedScopeMisses: 10,
        routeAdds: 11,
        routeRemoves: 12,
        fallbackPublications: 13,
        draftCreations: 14,
        scratchMapAllocations: 15,
        finalResolutionVisits: 16,
        finalPreflightVisits: 17,
        draftStorageAllocations: 18,
        commitWorksetAllocations: 19,
        subscriptionIndexMapsCreated: 20,
        subscriptionTargetsCreated: 21,
        subscriptionRegistrations: 22,
        subscriptionRemovals: 23,
        unsubscribeClosuresCreated: 24,
        activeSubscriptionScopes: 25,
        activeSubscriptionTargets: 26,
        activeSubscriptions: 27,
        notificationTargetsReached: 28,
        notificationSnapshots: 29,
        subscriberCallbacksAttempted: 30,
        subscriberErrors: 31,
        familyOwnerRetentionSetsCreated: 32,
        familyOwnerRetains: 33,
        familyOwnerReleases: 34,
    })

const STORE_TREE_COUNTER_COUNT = 35
const internalInstrumentationCounters = new WeakMap<
    InternalStoreTreeInstrumentation,
    Uint32Array
>()

export const createInternalStoreTreeInstrumentation =
    (): InternalStoreTreeInstrumentation => {
        const counters = new Uint32Array(STORE_TREE_COUNTER_COUNT)
        const instrumentation: InternalStoreTreeInstrumentation = Object.freeze(
            {
                read(counter: StoreTreeCounter): number {
                    return counters[STORE_TREE_COUNTER_INDEX[counter]] ?? 0
                },
            },
        )
        internalInstrumentationCounters.set(instrumentation, counters)
        return instrumentation
    }

const valueOutcome = (value: unknown): DraftAtomOutcome =>
    Object.freeze({ kind: "value", value })

const errorOutcome = (error: unknown): DraftAtomOutcome =>
    Object.freeze({ kind: "error", error })

const fromSynchronousResult = (result: SynchronousResult): DraftAtomOutcome =>
    result.kind === "value"
        ? valueOutcome(result.value)
        : errorOutcome(result.error)

const collectionSource = (
    domain: RuntimeDomainRecords,
    node: AnyState,
): OptionalCollectionVTable | undefined =>
    domain[COLLECTION_KERNEL]?.has(node) ? domain[COLLECTION_KERNEL] : undefined

const readCollectionValue = (
    kernel: OptionalCollectionVTable,
    draft: TreeDraft,
    scope: StoreScopeNode,
    node: AnyState,
): unknown => {
    const outcome = kernel.read(draft, scope, node)
    if (outcome.kind !== "value") throw outcome.error
    return outcome.value
}

const sameAtomOutcome = (
    previous: DraftAtomOutcome,
    next: DraftAtomOutcome,
): boolean => {
    if (previous.kind !== next.kind) return false
    if (previous.kind === "value" && next.kind === "value") {
        return Object.is(previous.value, next.value)
    }
    return (
        previous.kind !== "value" &&
        next.kind !== "value" &&
        Object.is(previous.error, next.error)
    )
}

const PROPAGATION_QUEUED = 1
const PROPAGATION_SETTLING = 2
const PROPAGATION_SETTLED = 4

const createCommitWorksets = (onAllocation?: () => void): CommitWorksets => ({
    onAllocation,
    preflightAtom: undefined,
    preflightScope: undefined,
    preflightOutcome: undefined,
    secondPreflightAtom: undefined,
    secondPreflightScope: undefined,
    secondPreflightOutcome: undefined,
    preflight: undefined,
    consideredRecord: undefined,
    secondConsideredRecord: undefined,
    considered: undefined,
    affectedRecord: undefined,
    affectedBefore: undefined,
    secondAffectedRecord: undefined,
    secondAffectedBefore: undefined,
    affected: undefined,
})

const allocateCommitMap = <Key, Value>(
    worksets: CommitWorksets,
): Map<Key, Value> => {
    worksets.onAllocation?.()
    return new Map<Key, Value>()
}

const allocateCommitSet = <Value>(worksets: CommitWorksets): Set<Value> => {
    worksets.onAllocation?.()
    return new Set<Value>()
}

const getPreflightOutcome = (
    worksets: CommitWorksets,
    atom: AnyAtom,
    scope: StoreScopeNode,
): DraftAtomOutcome | undefined => {
    if (
        worksets.preflightOutcome !== undefined &&
        Object.is(worksets.preflightAtom, atom) &&
        Object.is(worksets.preflightScope, scope)
    ) {
        return worksets.preflightOutcome
    }
    if (
        worksets.secondPreflightOutcome !== undefined &&
        Object.is(worksets.secondPreflightAtom, atom) &&
        Object.is(worksets.secondPreflightScope, scope)
    ) {
        return worksets.secondPreflightOutcome
    }
    return worksets.preflight?.get(atom)?.get(scope)
}

const setPreflightOutcome = (
    worksets: CommitWorksets,
    atom: AnyAtom,
    scope: StoreScopeNode,
    outcome: DraftAtomOutcome,
): void => {
    if (worksets.preflightOutcome === undefined) {
        worksets.preflightAtom = atom
        worksets.preflightScope = scope
        worksets.preflightOutcome = outcome
        return
    }
    if (
        Object.is(worksets.preflightAtom, atom) &&
        Object.is(worksets.preflightScope, scope)
    ) {
        return
    }
    if (worksets.secondPreflightOutcome === undefined) {
        worksets.secondPreflightAtom = atom
        worksets.secondPreflightScope = scope
        worksets.secondPreflightOutcome = outcome
        return
    }
    if (
        Object.is(worksets.secondPreflightAtom, atom) &&
        Object.is(worksets.secondPreflightScope, scope)
    ) {
        return
    }
    let preflight = worksets.preflight
    if (preflight === undefined) {
        preflight = allocateCommitMap(worksets)
        worksets.preflight = preflight
    }
    let byScope = preflight.get(atom)
    if (byScope === undefined) {
        byScope = allocateCommitMap(worksets)
        preflight.set(atom, byScope)
    }
    byScope.set(scope, outcome)
}

const markConsidered = (
    worksets: CommitWorksets,
    record: AtomViewRecord,
): boolean => {
    if (
        Object.is(worksets.consideredRecord, record) ||
        Object.is(worksets.secondConsideredRecord, record)
    ) {
        return false
    }
    if (worksets.consideredRecord === undefined) {
        worksets.consideredRecord = record
        return true
    }
    if (worksets.secondConsideredRecord === undefined) {
        worksets.secondConsideredRecord = record
        return true
    }
    let considered = worksets.considered
    if (considered === undefined) {
        considered = allocateCommitSet(worksets)
        worksets.considered = considered
    }
    if (considered.has(record)) return false
    considered.add(record)
    return true
}

const markAffected = (
    worksets: CommitWorksets,
    record: AtomViewRecord,
    before: DraftAtomOutcome,
): void => {
    if (worksets.affectedRecord === undefined) {
        worksets.affectedRecord = record
        worksets.affectedBefore = before
        return
    }
    if (worksets.secondAffectedRecord === undefined) {
        worksets.secondAffectedRecord = record
        worksets.secondAffectedBefore = before
        return
    }
    let affected = worksets.affected
    if (affected === undefined) {
        affected = allocateCommitMap(worksets)
        worksets.affected = affected
    }
    affected.set(record, before)
}

class CommittedStoreTreeHost
    implements StoreScopeCoordinator, TreeTransactionHost
{
    #fallbackRecords = new WeakMap<AnyAtom, DraftAtomOutcome>()
    readonly #rootScope: StoreScopeNode
    #nextToken = 1
    #sourceEpoch = 0
    #postSourceApply = false
    #propagationQueue: (StoreScopeNode | AnySelector)[] | undefined
    #propagationStatusScope: StoreScopeNode | undefined
    #propagationStatusSelector: AnySelector | undefined
    #propagationStatusBits = 0
    #propagationStatuses:
        | Map<StoreScopeNode, Map<AnySelector, number>>
        | undefined
    #propagationControlFault: unknown | undefined
    #subscriptionTargets:
        | Map<StoreScopeNode, Map<AnyState, SubscriptionTarget>>
        | undefined
    #nextNotificationEpoch = 1
    #notificationEpoch = 0
    #notificationTarget: SubscriptionTarget | undefined
    #remainingNotificationTargets: SubscriptionTarget[] | undefined
    readonly #domain: RuntimeDomainRecords
    readonly #counters: Uint32Array | undefined
    readonly #trace: InternalStoreTreeTrace | undefined
    readonly evaluate: SelectorEvaluationStrategy

    constructor(
        domain: RuntimeDomainRecords,
        instrumentation?: InternalStoreTreeInstrumentation,
        trace?: InternalStoreTreeTrace,
    ) {
        this.#domain = domain
        this.#counters =
            instrumentation === undefined
                ? undefined
                : internalInstrumentationCounters.get(instrumentation)
        this.#trace = trace
        this.evaluate = trace?.evaluate ?? evaluateSelector
        this.#rootScope = new StoreScopeNode(this)
        this.recordCounter("scopeNodesCreated")
    }

    get runtimeDomain(): RuntimeDomainRecords {
        return this.#domain
    }

    get postSourceApply(): boolean {
        return this.#postSourceApply
    }

    get instrumented(): boolean {
        return this.#counters !== undefined
    }

    get rootScope(): StoreScopeNode {
        return this.#rootScope
    }

    recordCounter(counter: StoreTreeCounter, amount = 1): void {
        const counters = this.#counters
        if (counters === undefined) return
        counters[STORE_TREE_COUNTER_INDEX[counter]] += amount
    }

    #createDraft(): TreeDraft {
        this.recordCounter("draftCreations")
        return new TreeDraft(
            this.instrumented
                ? () => this.recordCounter("draftStorageAllocations")
                : undefined,
        )
    }

    get<Value>(scope: StoreScopeNode, state: State<Value>): Value {
        const session = new SelectorEvaluationSession<AnyState>()
        const node = state as unknown as AnyState
        const ownerStatus = classifyEntryOwner(this.#domain, node, session)
        const subscriberSession = assertStoreReadAllowed(
            this.#domain,
            "StoreTree.get",
        )
        this.#assertScopeLive(scope)
        if (ownerStatus === "invalid") {
            throw new TypeError("StoreTree.get requires a valid State")
        }
        if (subscriberSession === undefined) {
            const served = scope.serveKnownLocal(node, session)
            if (served.outcome.kind !== "value") throw served.outcome.error
            return served.outcome.value as Value
        }
        try {
            const served = scope.serveKnownLocal(node, session)
            if (served.outcome.kind !== "value") {
                if (served.outcome.kind === "control-error") {
                    subscriberSession.latchControlFault(served.outcome.error)
                }
                throw served.outcome.error
            }
            return served.outcome.value as Value
        } catch (error) {
            const controlFault = session.getControlFault()
            if (controlFault.kind === "fault") {
                subscriberSession.latchControlFault(controlFault.error)
            }
            throw error
        }
    }

    sub<Value>(
        scope: StoreScopeNode,
        state: State<Value>,
        callback: () => void,
    ): () => void {
        const node = state as unknown as AnyState
        let session: SelectorEvaluationSession<AnyState> | undefined
        const ownerStatus = this.#domain.states.has(node)
            ? "local"
            : classifyEntryOwner(
                  this.#domain,
                  node,
                  (session = new SelectorEvaluationSession<AnyState>()),
              )
        assertStoreOperationAllowed(this.#domain, "StoreTree.sub")
        this.#assertScopeLive(scope)
        if (
            ownerStatus === "invalid" ||
            (!this.#domain.atoms.has(node) &&
                !this.#domain.selectors.has(node) &&
                !collectionSource(this.#domain, node))
        ) {
            throw new TypeError("StoreTree.sub requires a valid State")
        }
        if (typeof callback !== "function") {
            throw new TypeError("StoreTree.sub requires a callback function")
        }

        const served =
            scope.getMaterializedServedOutcome(node) ??
            scope.serveKnownLocal(
                node,
                session ?? new SelectorEvaluationSession<AnyState>(),
            )
        if (served.outcome.kind === "control-error") {
            throw served.outcome.error
        }

        let targets = this.#subscriptionTargets
        if (targets === undefined) {
            targets = new Map()
            this.#subscriptionTargets = targets
            if (this.instrumented) {
                this.recordCounter("subscriptionIndexMapsCreated")
            }
        }
        let byState = targets.get(scope)
        if (byState === undefined) {
            byState = new Map()
            targets.set(scope, byState)
            if (this.instrumented) {
                this.recordCounter("subscriptionIndexMapsCreated")
                this.recordCounter("activeSubscriptionScopes")
            }
        }
        let target = byState.get(node)
        if (target === undefined) {
            target = {
                host: this,
                scope,
                state: node,
                head: undefined,
                tail: undefined,
                reachedEpoch: 0,
            }
            byState.set(node, target)
            if (this.instrumented) {
                this.recordCounter("subscriptionTargetsCreated")
                this.recordCounter("activeSubscriptionTargets")
            }
        }
        const registration: SubscriptionRegistration = {
            callback: callback as SubscriberCallback,
            target,
            previous: target.tail,
            next: undefined,
        }
        if (target.tail === undefined) {
            target.head = registration
        } else {
            target.tail.next = registration
        }
        target.tail = registration
        if (this.instrumented) {
            this.recordCounter("subscriptionRegistrations")
            this.recordCounter("activeSubscriptions")
            this.recordCounter("unsubscribeClosuresCreated")
        }
        return createUnsubscribe(registration)
    }

    removeSubscription(registration: SubscriptionRegistration): void {
        const target = registration.target
        if (target === undefined) return
        assertUnsubscribeAllowed(this.#domain)

        const previous = registration.previous
        const next = registration.next
        if (previous === undefined) {
            target.head = next
        } else {
            previous.next = next
        }
        if (next === undefined) {
            target.tail = previous
        } else {
            next.previous = previous
        }
        registration.callback = undefined
        registration.target = undefined
        registration.previous = undefined
        registration.next = undefined
        const instrumented = this.instrumented
        if (instrumented) {
            this.recordCounter("subscriptionRemovals")
            this.recordCounter("activeSubscriptions", -1)
        }

        if (target.head !== undefined) return
        const targets = this.#subscriptionTargets
        const byState = targets?.get(target.scope)
        if (byState?.get(target.state) === target) {
            byState.delete(target.state)
            if (instrumented) {
                this.recordCounter("activeSubscriptionTargets", -1)
            }
        }
        if (byState !== undefined && byState.size === 0) {
            targets?.delete(target.scope)
            if (instrumented) {
                this.recordCounter("activeSubscriptionScopes", -1)
            }
        }
        if (targets?.size === 0) this.#subscriptionTargets = undefined
    }

    scope(
        parent: StoreScopeNode,
        argumentCount: number,
        id: unknown,
    ): CommittedStoreTree {
        if (
            argumentCount !== 0 &&
            (typeof id === "object" || typeof id === "function") &&
            id !== null
        ) {
            classifyEntryOwner(
                this.#domain,
                id,
                new SelectorEvaluationSession<AnyState>(),
            )
        }
        assertStoreOperationAllowed(this.#domain, "StoreTree.scope")
        this.#assertScopeLive(parent)

        if (argumentCount === 0) return this.#createChildScope(parent)
        if (argumentCount !== 1 || typeof id !== "string") {
            throw new TypeError("StoreTree.scope requires a string name")
        }
        const existing = parent.namedChildren.get(id)
        if (existing !== undefined) {
            this.recordCounter("namedScopeHits")
            return existing.facade as CommittedStoreTree
        }
        this.recordCounter("namedScopeMisses")
        return this.#createChildScope(parent, id)
    }

    dispose(scope: StoreScopeNode): void {
        assertStoreOperationAllowed(this.#domain, "StoreTree.dispose")
        if (scope.status !== "live") return

        const postorder: StoreScopeNode[] = []
        const pending: Readonly<{
            node: StoreScopeNode
            expanded: boolean
        }>[] = [Object.freeze({ node: scope, expanded: false })]
        while (pending.length > 0) {
            const { node, expanded } = pending.pop()!
            if (expanded) {
                postorder.push(node)
                continue
            }
            node.markDisposing()
            pending.push(Object.freeze({ node, expanded: true }))
            const children: StoreScopeNode[] = []
            node.children.forEach(child => children.push(child))
            for (let index = children.length - 1; index >= 0; index--) {
                pending.push(
                    Object.freeze({
                        node: children[index]!,
                        expanded: false,
                    }),
                )
            }
        }

        for (const node of postorder) {
            this.recordCounter("disposalVisits")
            const parent = node.parent
            if (parent !== undefined) {
                if (
                    node.name !== undefined &&
                    Object.is(parent.namedChildren.get(node.name), node)
                ) {
                    parent.namedChildren.delete(node.name)
                }
                parent.children.delete(node)
            }
            this.#dropSubscriptions(node)
            node.dropRecords()
            node.namedChildren.clear()
            node.children.clear()
            node.markDisposed()
        }
        if (Object.is(scope, this.#rootScope)) {
            this.#fallbackRecords = new WeakMap()
        }
    }

    txn<Result>(
        scope: StoreScopeNode,
        callback: TransactionCallback<Result>,
        name?: string,
    ): Result {
        assertStoreOperationAllowed(this.#domain, "StoreTree.txn")
        this.#assertScopeLive(scope)
        if (
            typeof callback !== "function" ||
            (name !== undefined && typeof name !== "string")
        ) {
            throw new TypeError("StoreTree.txn requires a callback")
        }

        const draft = this.#createDraft()
        const cursor = createRootTransactionCursor(this, draft, scope)
        let result: Result
        try {
            result = runTransactionActivity(
                this.#domain,
                draft.transaction,
                () =>
                    (
                        callback as unknown as (
                            transaction: typeof cursor,
                        ) => Result
                    )(cursor),
            )
        } catch (error) {
            draft.close()
            draft.release()
            throw error
        }
        draft.close()
        try {
            const resultSession = new SelectorEvaluationSession<AnyState>()
            runTransactionResultActivity(this.#domain, resultSession, () =>
                inspectTransactionCallbackResult(result),
            )
            this.#commitDraft(draft)
        } finally {
            draft.release()
        }
        return result
    }

    readHydrationSnapshot<Value>(
        scope: StoreScopeNode,
        state: State<Value>,
    ): Value {
        const session = new SelectorEvaluationSession<AnyState>()
        const node = state as unknown as AnyState
        const ownerStatus = classifyEntryOwner(this.#domain, node, session)
        assertStoreOperationAllowed(
            this.#domain,
            "adapter readHydrationSnapshot",
        )
        this.#assertScopeLive(scope)
        let coreKind: 0 | 1 | undefined
        let collectionKernel: OptionalCollectionVTable | false | undefined
        if (ownerStatus !== "invalid") {
            if (this.#domain.atoms.has(node)) {
                coreKind = 0
            } else if (this.#domain.selectors.has(node)) {
                coreKind = 1
            } else {
                collectionKernel = collectionSource(this.#domain, node)
            }
        }
        if (coreKind === undefined && !collectionKernel) {
            throw new TypeError("readHydrationSnapshot requires a valid State")
        }

        const draft = this.#createDraft()
        let scratchHost: ScratchSelectorHost<AnyState> | undefined
        try {
            if (coreKind === 0) {
                const outcome = this.#readDraftAtomOutcome(
                    draft,
                    scope,
                    node as AnyAtom,
                    session,
                )
                if (outcome.kind !== "value") throw outcome.error
                return outcome.value as Value
            }
            if (coreKind === undefined) {
                return readCollectionValue(
                    collectionKernel as OptionalCollectionVTable,
                    draft,
                    scope,
                    node,
                ) as Value
            }

            scratchHost = this.#createScratchSelectorHost(draft, scope, true)
            return scratchHost.readSelector<Value>(node)
        } finally {
            scratchHost?.revoke()
            draft.close()
            draft.forEachFallback((atom, outcome) => {
                if (this.#fallbackRecords.has(atom)) return
                this.#fallbackRecords.set(atom, outcome)
                this.recordCounter("fallbackPublications")
            })
            draft.release()
        }
    }

    transactionGet<Value>(
        draft: TreeDraft,
        scope: StoreScopeNode,
        state: State<Value>,
    ): Value {
        const node = state as unknown as AnyState
        const session = new SelectorEvaluationSession<AnyState>()
        const ownerStatus = classifyEntryOwner(this.#domain, node, session)
        assertCursorOperationAllowed(
            this.#domain,
            draft.transaction,
            draft.active,
        )
        this.#assertScopeLive(scope)
        if (ownerStatus === "invalid") {
            throw new TypeError("Transaction.get requires a valid State")
        }
        if (this.#domain.atoms.has(node)) {
            const outcome = this.#readDraftAtomOutcome(
                draft,
                scope,
                node as AnyAtom,
                session,
            )
            if (outcome.kind !== "value") throw outcome.error
            return outcome.value as Value
        }
        if (!this.#domain.selectors.has(node)) {
            const collectionKernel = collectionSource(this.#domain, node)
            if (!collectionKernel) {
                throw new TypeError("Transaction.get requires a readable State")
            }
            return readCollectionValue(
                collectionKernel,
                draft,
                scope,
                node,
            ) as Value
        }
        let scratchHost = draft.getScratchHost(scope)
        if (scratchHost === undefined) {
            scratchHost = this.#createScratchSelectorHost(draft, scope)
            if (draft.installScratchHost(scope, scratchHost)) {
                this.recordCounter("scratchMapAllocations")
            }
        }
        return scratchHost.readSelector<Value>(node)
    }

    mutate(
        draft: TreeDraft | undefined,
        scope: StoreScopeNode,
        intent: CollectionMutationKind,
        target: Atom<unknown> | CollectionRow<any, any>,
        input?: unknown,
    ): void {
        const node = target as unknown as AnyState
        const session = new SelectorEvaluationSession<AnyState>()
        const operation = `${draft === undefined ? "StoreTree" : "Transaction"}.${intent}`
        const ownerStatus = classifyEntryOwner(this.#domain, node, session)
        if (draft === undefined) {
            assertStoreOperationAllowed(this.#domain, operation)
        } else {
            assertCursorOperationAllowed(
                this.#domain,
                draft.transaction,
                draft.active,
            )
        }
        this.#assertScopeLive(scope)

        const atom = ownerStatus === "local" && this.#domain.atoms.has(node)
        let kernel: OptionalCollectionVTable | undefined
        const invalid = atom
            ? intent === "delete"
            : ownerStatus !== "local" ||
              typeof node === "function" ||
              (kernel = collectionSource(this.#domain, node)) === undefined
        if (invalid) {
            throw new TypeError(`${operation} requires a valid State`)
        }

        const ownDraft = draft === undefined
        const activeDraft = draft ?? this.#createDraft()
        try {
            if (kernel !== undefined) {
                kernel.stage(activeDraft, scope, intent, node, input, session)
            } else if (intent === "set") {
                this.#stageAtomSet(
                    activeDraft,
                    scope,
                    node as AnyAtom,
                    input,
                    session,
                )
            } else if (intent === "update") {
                this.#stageAtomUpdate(
                    activeDraft,
                    scope,
                    node as AnyAtom,
                    input as (current: unknown) => unknown,
                    session,
                    operation,
                )
            } else {
                this.#stageAtomReset(
                    activeDraft,
                    scope,
                    node as AnyAtom,
                    session,
                )
            }
        } catch (error) {
            if (ownDraft) {
                activeDraft.close()
                activeDraft.release()
            }
            throw error
        }
        if (!ownDraft) return
        activeDraft.close()
        try {
            this.#commitDraft(activeDraft)
        } finally {
            activeDraft.release()
        }
    }

    transactionScope<Result>(
        draft: TreeDraft,
        scope: StoreScopeNode,
        target: string | CommittedStoreTree,
        argumentCount: number,
        callback?: TransactionCallback<Result>,
    ): RootTransaction | Result {
        const session = new SelectorEvaluationSession<AnyState>()
        if (typeof target !== "string") {
            classifyEntryOwner(this.#domain, target, session)
        }
        assertCursorOperationAllowed(
            this.#domain,
            draft.transaction,
            draft.active,
        )
        this.#assertScopeLive(scope)

        const targetScope = this.#resolveTransactionScopeTarget(scope, target)
        if (argumentCount !== 1 && argumentCount !== 2) {
            throw new TypeError(
                "Transaction.scope requires a target and optional callback",
            )
        }
        const cursor = createRootTransactionCursor(this, draft, targetScope)
        if (argumentCount === 1) return cursor
        if (typeof callback !== "function") {
            throw new TypeError(
                "Transaction.scope requires a callback function",
            )
        }

        let result: Result
        try {
            result = (callback as (cursor: RootTransaction) => Result)(cursor)
        } catch (thrown) {
            const resultSession = new SelectorEvaluationSession<AnyState>()
            return runTransactionResultActivity(
                this.#domain,
                resultSession,
                () => rethrowTransactionCallbackThrow(thrown),
            )
        }
        const resultSession = new SelectorEvaluationSession<AnyState>()
        runTransactionResultActivity(this.#domain, resultSession, () =>
            inspectTransactionCallbackResult(result),
        )
        return result
    }

    createOutcomeToken(): OutcomeToken {
        return Object.freeze({ id: this.#nextToken++ })
    }

    #createScratchSelectorHost(
        draft: TreeDraft,
        scope: StoreScopeNode,
        hydration = false,
    ): ScratchSelectorHost<AnyState> {
        this.recordCounter("scratchHostAllocations")
        return new ScratchSelectorHost<AnyState>(
            Object.freeze({
                resolve: (
                    node: AnyState,
                    session: SelectorEvaluationSession<AnyState>,
                ) => this.#resolveScratchState(node, session),
                read: (
                    source: AnyState,
                    kind: ScratchSourceKind,
                    session: SelectorEvaluationSession<AnyState>,
                ) =>
                    this.#readDraftSourceOutcome(
                        draft,
                        scope,
                        source,
                        kind,
                        session,
                    ),
                baseline: hydration
                    ? () => undefined
                    : (selector: AnyState) =>
                          scope.captureCommittedSelectorSuccess(
                              selector as AnySelector,
                          ),
                run: <Result>(
                    session: SelectorEvaluationSession<AnyState>,
                    operation: () => Result,
                ): Result =>
                    runSelectorActivity(this.#domain, session, operation),
            }),
            draft.generation,
            this.evaluate,
        )
    }

    #resolveScratchState(
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ResolvedScratchState<AnyState> {
        if (classifyOwner(this.#domain, node, session) === "invalid") {
            throw new TypeError("Selector get requires a valid State")
        }
        if (this.#domain.atoms.has(node)) {
            return Object.freeze({ kind: "atom" })
        }
        const definition = this.#domain.selectors.get(node)
        if (definition !== undefined) {
            return Object.freeze({ kind: "selector", definition })
        }
        if (collectionSource(this.#domain, node)) {
            return Object.freeze({ kind: "ext" })
        }
        throw new TypeError("Unknown scratch StoreTree State")
    }

    #createChildScope(
        parent: StoreScopeNode,
        name?: string,
    ): CommittedStoreTree {
        const child = new StoreScopeNode(this, parent, name)
        this.recordCounter("scopeNodesCreated")
        const facade = new CommittedStoreTreeFacade(this, child, this.#trace)
        parent.children.add(child)
        if (name !== undefined) parent.namedChildren.set(name, child)
        return facade
    }

    #resolveTransactionScopeTarget(
        current: StoreScopeNode,
        target: string | CommittedStoreTree,
    ): StoreScopeNode {
        if (typeof target === "string") {
            const child = current.namedChildren.get(target)
            if (child === undefined) throw new ScopeNotFoundError()
            this.#assertScopeLive(child)
            return child
        }

        const targetObject = target as unknown as object
        const registeredStore = this.#domain.stores.get(targetObject)
        if (registeredStore !== undefined) {
            const targetScope = registeredStore as StoreScopeNode
            this.#assertScopeLive(targetScope)
            if (!Object.is(targetScope.coordinator, this)) {
                throw new StoreTreeMismatchError()
            }
            return targetScope
        }

        const registeredCursor =
            this.#domain.transactionCursors.get(targetObject)
        if (registeredCursor !== undefined) {
            if (!(registeredCursor as TreeDraft).active) {
                throw new TransactionClosedError()
            }
            throw new InvalidTransactionTargetError()
        }
        throw new InvalidTransactionTargetError()
    }

    #assertScopeLive(scope: StoreScopeNode): void {
        if (scope.status !== "live") throw new StoreDisposedError()
    }

    #dropSubscriptions(scope: StoreScopeNode): void {
        const targets = this.#subscriptionTargets
        const byState = targets?.get(scope)
        if (byState === undefined) return

        let removed = 0
        for (const target of byState.values()) {
            let registration = target.head
            while (registration !== undefined) {
                const next = registration.next
                registration.callback = undefined
                registration.target = undefined
                registration.previous = undefined
                registration.next = undefined
                removed++
                registration = next
            }
            target.head = undefined
            target.tail = undefined
        }
        targets!.delete(scope)
        if (targets!.size === 0) this.#subscriptionTargets = undefined
        if (this.instrumented) {
            this.recordCounter("subscriptionRemovals", removed)
            this.recordCounter("activeSubscriptions", -removed)
            this.recordCounter("activeSubscriptionTargets", -byState.size)
            this.recordCounter("activeSubscriptionScopes", -1)
        }
    }

    #stageAtomSet(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: AnyAtom,
        value: unknown,
        session: SelectorEvaluationSession<AnyState>,
    ): void {
        const inspected = runGuardedCallback(this.#domain, session, () =>
            inspectSynchronousAtomValue(value),
        )
        if (inspected.kind === "error") throw inspected.error

        const baseline = this.#getDraftAtomBaseline(draft, scope, atom, session)
        this.#stageAlreadyInspectedAtomSet(
            draft,
            scope,
            atom,
            inspected.value,
            baseline,
            session,
        )
    }

    #stageAtomUpdate(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: AnyAtom,
        update: (current: unknown) => unknown,
        session: SelectorEvaluationSession<AnyState>,
        operation: string,
    ): void {
        if (typeof update !== "function") {
            throw new TypeError(`${operation} requires an updater function`)
        }

        const baseline = this.#getDraftAtomBaseline(draft, scope, atom, session)
        const current = draft.hasIntents
            ? this.#readDraftAtomOutcome(draft, scope, atom, session)
            : baseline.outcome
        if (current.kind !== "value") throw current.error
        const candidate = this.#runAtomUpdater(update, current.value, session)
        this.#stageAlreadyInspectedAtomSet(
            draft,
            scope,
            atom,
            candidate,
            baseline,
            session,
        )
    }

    #stageAtomReset(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): void {
        this.#getDraftAtomBaseline(draft, scope, atom, session)
        const after =
            scope.parent === undefined
                ? Object.freeze({
                      outcome: this.#getDraftFallbackOutcome(
                          draft,
                          atom,
                          session,
                      ),
                      reachesFallback: true,
                  })
                : this.#readDraftAtomResolution(
                      draft,
                      scope.parent,
                      atom,
                      session,
                  )
        if (after.outcome.kind !== "value") throw after.outcome.error
        const publishDraftFallback =
            after.reachesFallback && draft.hasFallback(atom)
        draft.stage(
            scope,
            Object.freeze({
                kind: "reset",
                atom,
                publishDraftFallback,
            }),
        )
    }

    #getDraftAtomBaseline(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): AtomDraftBaseline {
        const existing = draft.getAtomBaseline(scope, atom)
        if (existing !== undefined) return existing
        const owned = scope.atomOverrides.has(atom)
        let current: StoreScopeNode | undefined = scope
        let inherited: DraftAtomOutcome | undefined
        while (current !== undefined) {
            if (current.atomOverrides.has(atom)) {
                inherited = valueOutcome(current.atomOverrides.get(atom))
                break
            }
            current = current.parent
        }
        const reachesFallback = inherited === undefined
        const baseline = Object.freeze({
            owned,
            outcome:
                inherited ??
                this.#getDraftFallbackOutcome(draft, atom, session),
            reachesFallback,
        })
        draft.setAtomBaseline(scope, atom, baseline)
        return baseline
    }

    #readDraftAtomOutcome(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): DraftAtomOutcome {
        return this.#readDraftAtomResolution(draft, scope, atom, session)
            .outcome
    }

    #readDraftSourceOutcome(
        draft: TreeDraft,
        scope: StoreScopeNode,
        source: AnyState,
        kind: ScratchSourceKind,
        session: SelectorEvaluationSession<AnyState>,
    ): DraftAtomOutcome {
        if (kind === "atom") {
            return this.#readDraftAtomOutcome(
                draft,
                scope,
                source as AnyAtom,
                session,
            )
        }
        return this.#domain[COLLECTION_KERNEL]!.read(draft, scope, source)
    }

    #readDraftAtomResolution(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): Readonly<{ outcome: DraftAtomOutcome; reachesFallback: boolean }> {
        let current: StoreScopeNode | undefined = scope
        while (current !== undefined) {
            const intent = draft.getIntent(current, atom)
            if (intent?.kind === "set") {
                return Object.freeze({
                    outcome: valueOutcome(intent.value),
                    reachesFallback: false,
                })
            }
            if (intent === undefined && current.atomOverrides.has(atom)) {
                return Object.freeze({
                    outcome: valueOutcome(current.atomOverrides.get(atom)),
                    reachesFallback: false,
                })
            }
            current = current.parent
        }
        return Object.freeze({
            outcome: this.#getDraftFallbackOutcome(draft, atom, session),
            reachesFallback: true,
        })
    }

    #getDraftFallbackOutcome(
        draft: TreeDraft,
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): DraftAtomOutcome {
        const committed = this.#fallbackRecords.get(atom)
        if (committed !== undefined) return committed
        const definition = this.#atomDefinition(atom)
        if (definition.fallback.kind === "eager") {
            return valueOutcome(definition.fallback.value)
        }
        const initialize = definition.fallback.initialize
        const memoized = draft.getFallback(atom)
        if (memoized !== undefined) return memoized
        const outcome = fromSynchronousResult(
            runGuardedCallback(this.#domain, session, () =>
                runLazyInitializer(initialize),
            ),
        )
        draft.setFallback(atom, outcome)
        return outcome
    }

    #canonicalizeAtomCandidate(
        atom: AnyAtom,
        baseline: unknown,
        candidate: unknown,
        session: SelectorEvaluationSession<AnyState>,
    ): unknown {
        const compare = this.#atomDefinition(atom).equal
        if (compare === undefined) {
            return Object.is(baseline, candidate) ? baseline : candidate
        }
        return this.#runAtomComparator(compare, baseline, candidate, session)
            ? baseline
            : candidate
    }

    #runAtomComparator(
        compare: (previous: unknown, next: unknown) => boolean,
        baseline: unknown,
        candidate: unknown,
        session: SelectorEvaluationSession<AnyState>,
    ): boolean {
        return runGuardedCallback(this.#domain, session, () => {
            let returned: unknown
            try {
                returned = compare(baseline, candidate)
            } catch (thrown) {
                const inspected = inspectThenable(thrown)
                if (inspected.kind === "not-thenable") throw thrown
                if (inspected.kind === "inspection-error") {
                    throw inspected.error
                }
                containThenable(inspected)
                throw new InvalidAtomComparatorResultError()
            }
            const inspected = inspectThenable(returned)
            if (inspected.kind === "inspection-error") throw inspected.error
            if (inspected.kind === "thenable") {
                containThenable(inspected)
                throw new InvalidAtomComparatorResultError()
            }
            if (returned !== true && returned !== false) {
                throw new InvalidAtomComparatorResultError()
            }
            return returned
        })
    }

    #runAtomUpdater(
        update: (current: unknown) => unknown,
        current: unknown,
        session: SelectorEvaluationSession<AnyState>,
    ): unknown {
        return runGuardedCallback(this.#domain, session, () => {
            let returned: unknown
            try {
                returned = update(current)
            } catch (thrown) {
                const inspected = inspectThenable(thrown)
                if (inspected.kind === "not-thenable") throw thrown
                if (inspected.kind === "inspection-error") {
                    throw inspected.error
                }
                containThenable(inspected)
                throw new InvalidSynchronousAtomValueError()
            }
            const inspected = inspectSynchronousAtomValue(returned)
            if (inspected.kind === "error") throw inspected.error
            return inspected.value
        })
    }

    #commitDraft(draft: TreeDraft): void {
        let collectionPlan: CollectionCommitPlan | undefined
        if (draft.hasRows) {
            collectionPlan = this.#domain[COLLECTION_KERNEL]?.plan(this, draft)
            if (collectionPlan === undefined) throw new Error()
        }
        if (!draft.hasIntents && collectionPlan === undefined) return

        const singleIntent = draft.singleIntent
        const singleScope = draft.singleIntentScope
        if (
            collectionPlan === undefined &&
            singleIntent?.kind === "reset" &&
            singleScope !== undefined &&
            !singleIntent.publishDraftFallback &&
            draft.getAtomBaseline(singleScope, singleIntent.atom)?.owned ===
                false
        ) {
            return
        }

        /*
         * Commit is one ordered, user-code-free source settlement:
         *
         *     draft intents -> inert preflight -> publish fallbacks
         *                   -> apply every owner -> rewire every source route
         *                   -> memoized final outcomes -> one propagation
         *
         * The first two workset entries stay inline. Later entries lazily
         * promote the same pipeline to collections; no selector observes a
         * partially applied multi-scope source set.
         */
        const worksets = createCommitWorksets(
            this.instrumented
                ? () => this.recordCounter("commitWorksetAllocations")
                : undefined,
        )
        let firstPlan: AtomApplyPlan | undefined
        let remainingPlan: AtomApplyPlan[] | undefined
        if (singleIntent !== undefined && singleScope !== undefined) {
            firstPlan = this.#prepareAtomApplyPlan(
                draft,
                singleScope,
                singleIntent,
                worksets,
            )
        } else {
            draft.forEachIntent((scope, intent) => {
                const entry = this.#prepareAtomApplyPlan(
                    draft,
                    scope,
                    intent,
                    worksets,
                )
                if (firstPlan === undefined) {
                    firstPlan = entry
                    return
                }
                if (remainingPlan === undefined) remainingPlan = []
                remainingPlan.push(entry)
            })
        }
        this.#trace?.(1, draft, this.#domain.atoms)

        // Apply every fallback publication and owned source before propagation.
        if (firstPlan !== undefined) {
            this.#publishPlanFallback(draft, firstPlan)
        }
        if (remainingPlan !== undefined) {
            for (const entry of remainingPlan) {
                this.#publishPlanFallback(draft, entry)
            }
        }

        let ownershipChanged =
            firstPlan === undefined ? false : this.#applyPlanOwner(firstPlan)
        if (remainingPlan !== undefined) {
            for (const entry of remainingPlan) {
                const entryOwnershipChanged = this.#applyPlanOwner(entry)
                ownershipChanged ||= entryOwnershipChanged
            }
        }
        if (collectionPlan !== undefined) {
            const collectionOwnershipChanged = collectionPlan.commit(this, 0)
            ownershipChanged ||= collectionOwnershipChanged
        }
        // Rewire every materialized target only after every local source applies.
        if (firstPlan !== undefined) this.#rewirePlanAtomView(firstPlan)
        if (remainingPlan !== undefined) {
            for (const entry of remainingPlan) {
                this.#rewirePlanAtomView(entry)
            }
        }
        if (collectionPlan !== undefined) {
            collectionPlan.commit(this, 1)
        }

        this.#beginNotificationSettlement()
        try {
            let firstChangedSource: AtomViewRecord | undefined
            let remainingChangedSources: AtomViewRecord[] | undefined
            const firstAffectedRecord = worksets.affectedRecord
            const firstAffectedBefore = worksets.affectedBefore
            if (
                firstAffectedRecord !== undefined &&
                firstAffectedBefore !== undefined
            ) {
                firstChangedSource = this.#settleAffectedAtomView(
                    worksets,
                    firstAffectedRecord,
                    firstAffectedBefore,
                )
            }
            const secondAffectedRecord = worksets.secondAffectedRecord
            const secondAffectedBefore = worksets.secondAffectedBefore
            if (
                secondAffectedRecord !== undefined &&
                secondAffectedBefore !== undefined
            ) {
                const source = this.#settleAffectedAtomView(
                    worksets,
                    secondAffectedRecord,
                    secondAffectedBefore,
                )
                if (source !== undefined) {
                    if (firstChangedSource === undefined) {
                        firstChangedSource = source
                    } else {
                        remainingChangedSources = [source]
                    }
                }
            }
            if (worksets.affected !== undefined) {
                for (const [record, before] of worksets.affected) {
                    const source = this.#settleAffectedAtomView(
                        worksets,
                        record,
                        before,
                    )
                    if (source === undefined) continue
                    if (firstChangedSource === undefined) {
                        firstChangedSource = source
                    } else {
                        if (remainingChangedSources === undefined) {
                            remainingChangedSources = []
                        }
                        remainingChangedSources.push(source)
                    }
                }
            }
            if (collectionPlan !== undefined) {
                const sources = collectionPlan.commit(this, 2)
                if (sources !== undefined) {
                    for (const source of sources) {
                        const current = source as AtomViewRecord
                        if (firstChangedSource === undefined) {
                            firstChangedSource = current
                        } else {
                            if (remainingChangedSources === undefined) {
                                remainingChangedSources = []
                            }
                            remainingChangedSources.push(current)
                        }
                    }
                }
            }
            if (ownershipChanged) {
                this.#sourceEpoch += 1
                this.recordCounter("sourceEpoch")
            }
            this.#trace?.(
                2,
                firstChangedSource === undefined
                    ? 0
                    : 1 + (remainingChangedSources?.length ?? 0),
            )
            this.#propagateFromSources(
                firstChangedSource,
                remainingChangedSources,
            )
        } catch (error) {
            this.#clearNotificationSettlement()
            throw error
        }
    }

    #prepareAtomApplyPlan(
        draft: TreeDraft,
        scope: StoreScopeNode,
        intent: AtomIntent,
        worksets: CommitWorksets,
    ): AtomApplyPlan {
        const baseline = draft.getAtomBaseline(scope, intent.atom)
        if (baseline === undefined) {
            throw new Error("TreeDraft atom baseline is missing")
        }
        this.#readFinalAtomOutcome(draft, scope, intent.atom, worksets)
        const entry: AtomApplyPlan = Object.freeze({
            scope,
            intent,
            ownershipChanged:
                intent.kind === "set"
                    ? !baseline.owned ||
                      !Object.is(
                          scope.atomOverrides.get(intent.atom),
                          intent.value,
                      )
                    : baseline.owned,
        })
        const record = scope.getAtomView(intent.atom)
        if (record !== undefined) {
            this.#collectAffectedAtomViews(draft, record, worksets)
        }
        return entry
    }

    #publishPlanFallback(draft: TreeDraft, entry: AtomApplyPlan): void {
        if (!entry.intent.publishDraftFallback) return
        const fallback = draft.getFallback(entry.intent.atom)
        if (
            fallback !== undefined &&
            !this.#fallbackRecords.has(entry.intent.atom)
        ) {
            this.#fallbackRecords.set(entry.intent.atom, fallback)
            this.recordCounter("fallbackPublications")
        }
    }

    #applyPlanOwner(entry: AtomApplyPlan): boolean {
        const { intent, scope } = entry
        if (intent.kind === "set") {
            scope.atomOverrides.set(intent.atom, intent.value)
            if (this.#domain[REACQUIRABLE_ATOMS]?.has(intent.atom)) {
                let retained = scope[REACQUIRABLE_ATOMS]
                if (retained === undefined) {
                    retained = new Set()
                    scope[REACQUIRABLE_ATOMS] = retained
                    this.recordCounter("familyOwnerRetentionSetsCreated")
                }
                const retainedBefore = retained.size
                retained.add(intent.atom)
                if (retained.size !== retainedBefore) {
                    this.recordCounter("familyOwnerRetains")
                }
            }
        } else {
            scope.atomOverrides.delete(intent.atom)
            const retained = scope[REACQUIRABLE_ATOMS]
            if (retained?.delete(intent.atom)) {
                this.recordCounter("familyOwnerReleases")
            }
            if (retained?.size === 0) scope[REACQUIRABLE_ATOMS] = undefined
        }
        return entry.ownershipChanged
    }

    #rewirePlanAtomView({ scope, intent }: AtomApplyPlan): void {
        const record = scope.getAtomView(intent.atom)
        if (record === undefined) return
        if (intent.kind === "set" || scope.parent === undefined) {
            scope.detachAtomView(record)
        } else {
            scope.attachAtomView(
                record,
                this.#materializeAtomViewInert(scope.parent, intent.atom),
            )
        }
    }

    #settleAffectedAtomView(
        worksets: CommitWorksets,
        record: AtomViewRecord,
        before: DraftAtomOutcome,
    ): AtomViewRecord | undefined {
        const after = getPreflightOutcome(worksets, record.atom, record.scope)
        if (after === undefined) {
            throw new Error("Affected AtomView final outcome is missing")
        }
        this.recordCounter("finalResolutionVisits")
        if (sameAtomOutcome(before, after)) return undefined
        record.scope.updateAtomView(record, after)
        return record
    }

    #collectAffectedAtomViews(
        draft: TreeDraft,
        record: AtomViewRecord,
        worksets: CommitWorksets,
    ): void {
        const pending = [record]
        while (pending.length !== 0) {
            const current = pending.pop() as AtomViewRecord
            if (!markConsidered(worksets, current)) continue
            const before = current.served.outcome as DraftAtomOutcome
            const after = this.#readFinalAtomOutcome(
                draft,
                current.scope,
                current.atom,
                worksets,
            )
            if (sameAtomOutcome(before, after)) continue
            markAffected(worksets, current, before)
            const firstChild = pending.length
            current.inheritingChildren.forEach(child => {
                this.recordCounter("routeVisits")
                pending.push(child)
            })
            for (
                let left = firstChild, right = pending.length - 1;
                left < right;
                left++, right--
            ) {
                const child = pending[left] as AtomViewRecord
                pending[left] = pending[right] as AtomViewRecord
                pending[right] = child
            }
        }
    }

    #readFinalAtomOutcome(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: AnyAtom,
        worksets: CommitWorksets,
    ): DraftAtomOutcome {
        const existing = getPreflightOutcome(worksets, atom, scope)
        if (existing !== undefined) return existing

        let current: StoreScopeNode | undefined = scope
        let firstUnresolved: StoreScopeNode | undefined
        let remainingUnresolved: StoreScopeNode[] | undefined
        let outcome: DraftAtomOutcome | undefined
        while (current !== undefined) {
            const memoized = getPreflightOutcome(worksets, atom, current)
            if (memoized !== undefined) {
                outcome = memoized
                break
            }
            if (firstUnresolved === undefined) {
                firstUnresolved = current
            } else {
                if (remainingUnresolved === undefined) remainingUnresolved = []
                remainingUnresolved.push(current)
            }
            const intent = draft.getIntent(current, atom)
            if (intent?.kind === "set") {
                outcome = valueOutcome(intent.value)
                break
            }
            if (intent === undefined && current.atomOverrides.has(atom)) {
                outcome = valueOutcome(current.atomOverrides.get(atom))
                break
            }
            current = current.parent
        }
        outcome ??= this.#readFinalFallbackOutcome(draft, atom)
        if (firstUnresolved !== undefined) {
            setPreflightOutcome(worksets, atom, firstUnresolved, outcome)
            this.recordCounter("finalPreflightVisits")
        }
        if (remainingUnresolved !== undefined) {
            for (const unresolvedScope of remainingUnresolved) {
                setPreflightOutcome(worksets, atom, unresolvedScope, outcome)
                this.recordCounter("finalPreflightVisits")
            }
        }
        return outcome
    }

    #readFinalFallbackOutcome(
        draft: TreeDraft,
        atom: AnyAtom,
    ): DraftAtomOutcome {
        const committed = this.#fallbackRecords.get(atom)
        if (committed !== undefined) return committed
        const memoized = draft.getFallback(atom)
        if (memoized !== undefined) return memoized
        const definition = this.#atomDefinition(atom)
        if (definition.fallback.kind === "eager") {
            return valueOutcome(definition.fallback.value)
        }
        throw new Error("Final Atom fallback was not resolved during staging")
    }

    #readCommittedFallbackOutcomeInert(atom: AnyAtom): DraftAtomOutcome {
        const committed = this.#fallbackRecords.get(atom)
        if (committed !== undefined) return committed
        const definition = this.#atomDefinition(atom)
        if (definition.fallback.kind === "eager") {
            return valueOutcome(definition.fallback.value)
        }
        throw new Error("Committed Atom fallback is not materialized")
    }

    #materializeAtomViewInert(
        scope: StoreScopeNode,
        atom: AnyAtom,
    ): AtomViewRecord {
        let currentScope = scope
        const unresolved: StoreScopeNode[] = []
        let current: AtomViewRecord

        while (true) {
            const materialized = currentScope.getAtomView(atom)
            if (materialized !== undefined) {
                current = materialized
                break
            }
            if (currentScope.atomOverrides.has(atom)) {
                current = currentScope.createAtomView(
                    atom,
                    valueOutcome(currentScope.atomOverrides.get(atom)),
                )
                break
            }
            if (currentScope.parent === undefined) {
                current = currentScope.createAtomView(
                    atom,
                    this.#readCommittedFallbackOutcomeInert(atom),
                )
                break
            }
            unresolved.push(currentScope)
            currentScope = currentScope.parent
        }

        for (let index = unresolved.length - 1; index >= 0; index--) {
            current = (unresolved[index] as StoreScopeNode).createAtomView(
                atom,
                current.served.outcome as DraftAtomOutcome,
                current,
            )
        }
        return current
    }

    serveScopeAtom(
        scope: StoreScopeNode,
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken> {
        let currentScope = scope
        const unresolved: StoreScopeNode[] = []
        let current: AtomViewRecord

        while (true) {
            const materialized = currentScope.getAtomView(atom)
            if (materialized !== undefined) {
                current = materialized
                break
            }
            if (currentScope.atomOverrides.has(atom)) {
                current = currentScope.createAtomView(
                    atom,
                    valueOutcome(currentScope.atomOverrides.get(atom)),
                )
                break
            }
            if (currentScope.parent === undefined) {
                current = currentScope.createAtomView(
                    atom,
                    this.#getCommittedFallbackOutcome(atom, session),
                )
                break
            }
            this.recordCounter("warmParentHops")
            unresolved.push(currentScope)
            currentScope = currentScope.parent
        }

        for (let index = unresolved.length - 1; index >= 0; index--) {
            current = (unresolved[index] as StoreScopeNode).createAtomView(
                atom,
                current.served.outcome as DraftAtomOutcome,
                current,
            )
        }
        return current.served
    }

    #getCommittedFallbackOutcome(
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): DraftAtomOutcome {
        const current = this.#fallbackRecords.get(atom)
        if (current !== undefined) return current
        const definition = this.#atomDefinition(atom)
        if (definition.fallback.kind === "eager") {
            return valueOutcome(definition.fallback.value)
        }
        const initialize = definition.fallback.initialize
        const outcome = fromSynchronousResult(
            runGuardedCallback(this.#domain, session, () =>
                runLazyInitializer(initialize),
            ),
        )
        this.#fallbackRecords.set(atom, outcome)
        this.recordCounter("fallbackPublications")
        return outcome
    }

    #atomDefinition(atom: AnyAtom): AtomDefinition {
        const definition = this.#domain.atoms.get(atom)
        if (definition === undefined) {
            throw new TypeError("Unknown committed StoreTree Atom")
        }
        return definition
    }

    #propagateFromSources(
        firstSource: AtomViewRecord | undefined,
        remainingSources?: readonly AtomViewRecord[],
    ): void {
        if (firstSource === undefined) {
            this.#clearNotificationSettlement()
            return
        }
        this.recordCounter("propagationSettlements")
        this.#propagationQueue = []
        this.#propagationStatusScope = undefined
        this.#propagationStatusSelector = undefined
        this.#propagationStatusBits = 0
        this.#propagationStatuses = undefined
        this.#propagationControlFault = undefined
        this.#postSourceApply = true
        let authoritativeControlFault: unknown | undefined
        try {
            firstSource.scope.markDependents(firstSource.atom)
            if (remainingSources !== undefined) {
                for (const source of remainingSources) {
                    source.scope.markDependents(source.atom)
                }
            }
            let cursor = 0
            while (cursor < this.#propagationQueue.length) {
                const scope = this.#propagationQueue[cursor++] as StoreScopeNode
                const selector = this.#propagationQueue[cursor++] as AnySelector
                this.#settleSelector(scope, selector)
            }
        } finally {
            authoritativeControlFault = this.#propagationControlFault
            this.#propagationControlFault = undefined
            this.#postSourceApply = false
            this.#propagationQueue = undefined
            this.#propagationStatusScope = undefined
            this.#propagationStatusSelector = undefined
            this.#propagationStatusBits = 0
            this.#propagationStatuses = undefined
        }
        this.#deliverSubscriptionSnapshot(authoritativeControlFault)
    }

    #beginNotificationSettlement(): void {
        this.#notificationTarget = undefined
        this.#remainingNotificationTargets = undefined
        this.#notificationEpoch =
            this.#subscriptionTargets === undefined
                ? 0
                : this.#nextNotificationEpoch++
    }

    #clearNotificationSettlement(): void {
        this.#notificationEpoch = 0
        this.#notificationTarget = undefined
        this.#remainingNotificationTargets = undefined
    }

    reachSubscriptionTarget(scope: StoreScopeNode, state: AnyState): void {
        const epoch = this.#notificationEpoch
        const target = this.#subscriptionTargets?.get(scope)?.get(state)
        if (
            epoch === 0 ||
            target === undefined ||
            target.reachedEpoch === epoch
        ) {
            return
        }
        target.reachedEpoch = epoch
        if (this.instrumented) {
            this.recordCounter("notificationTargetsReached")
        }
        if (this.#notificationTarget === undefined) {
            this.#notificationTarget = target
            return
        }
        if (this.#remainingNotificationTargets === undefined) {
            this.#remainingNotificationTargets = [target]
        } else {
            this.#remainingNotificationTargets.push(target)
        }
    }

    #deliverSubscriptionSnapshot(
        authoritativeControlFault: unknown | undefined,
    ): void {
        const firstTarget = this.#notificationTarget
        if (firstTarget === undefined) {
            this.#clearNotificationSettlement()
            if (authoritativeControlFault !== undefined) {
                throw authoritativeControlFault
            }
            return
        }
        let firstCallback: SubscriberCallback | undefined
        let snapshot: SubscriberCallback[] | undefined
        const capture = (target: SubscriptionTarget): void => {
            let registration = target.head
            while (registration !== undefined) {
                const callback = registration.callback
                if (callback !== undefined) {
                    if (firstCallback === undefined) {
                        firstCallback = callback
                    } else if (snapshot === undefined) {
                        snapshot = [firstCallback, callback]
                    } else {
                        snapshot.push(callback)
                    }
                }
                registration = registration.next
            }
        }

        capture(firstTarget)
        const remainingTargets = this.#remainingNotificationTargets
        if (remainingTargets !== undefined) {
            for (const target of remainingTargets) capture(target)
        }
        this.#clearNotificationSettlement()

        if (firstCallback === undefined) {
            if (authoritativeControlFault !== undefined) {
                throw authoritativeControlFault
            }
            return
        }
        const frozenSnapshot = Object.freeze(snapshot ?? [firstCallback])
        const instrumented = this.instrumented
        if (instrumented) this.recordCounter("notificationSnapshots")
        let subscriberErrors: unknown[] | undefined
        for (const callback of frozenSnapshot) {
            if (instrumented) {
                this.recordCounter("subscriberCallbacksAttempted")
            }
            const session = new SelectorEvaluationSession<AnyState>()
            let callbackThrew = false
            let callbackError: unknown
            try {
                runSubscriberActivity(this.#domain, session, () => {
                    try {
                        const returned = callback()
                        const inspected = inspectThenable(returned)
                        if (inspected.kind === "thenable") {
                            containThenable(inspected)
                        } else if (inspected.kind === "inspection-error") {
                            callbackThrew = true
                            callbackError = inspected.error
                        }
                    } catch (thrown) {
                        callbackThrew = true
                        callbackError = thrown
                        const inspected = inspectThenable(thrown)
                        if (inspected.kind === "thenable") {
                            containThenable(inspected)
                        }
                    }
                })
            } catch (controlFault) {
                callbackThrew = true
                callbackError = controlFault
            }
            if (callbackThrew) {
                if (subscriberErrors === undefined) subscriberErrors = []
                subscriberErrors.push(callbackError)
                if (instrumented) this.recordCounter("subscriberErrors")
            }
        }

        if (subscriberErrors === undefined) {
            if (authoritativeControlFault !== undefined) {
                throw authoritativeControlFault
            }
            return
        }
        throw new SubscriberNotificationError(
            authoritativeControlFault === undefined
                ? subscriberErrors
                : [authoritativeControlFault, ...subscriberErrors],
        )
    }

    enqueueSelector(scope: StoreScopeNode, selector: AnySelector): boolean {
        const queue = this.#propagationQueue
        if (queue === undefined) return false
        if (
            (this.#getPropagationStatus(scope, selector) &
                PROPAGATION_QUEUED) !==
            0
        ) {
            return true
        }
        this.#updatePropagationStatus(scope, selector, PROPAGATION_QUEUED)
        queue.push(scope, selector)
        return true
    }

    prepareSelectorRead(
        scope: StoreScopeNode,
        selector: AnySelector,
        session: SelectorEvaluationSession<AnyState>,
    ): void {
        if (this.#propagationQueue === undefined) return
        this.#settleSelector(scope, selector, session)
    }

    #settleSelector(
        scope: StoreScopeNode,
        selector: AnySelector,
        session?: SelectorEvaluationSession<AnyState>,
    ): void {
        const status = this.#getPropagationStatus(scope, selector)
        if ((status & (PROPAGATION_SETTLED | PROPAGATION_SETTLING)) !== 0) {
            return
        }
        this.#updatePropagationStatus(scope, selector, PROPAGATION_SETTLING)
        try {
            const graphVersionBeforeDependencies =
                scope.getSelectorGraphVersion()
            const dependencies =
                scope.getCommittedSelectorDependencies(selector)
            if (dependencies !== undefined) {
                for (const dependency of dependencies) {
                    if (this.#domain.selectors.has(dependency.node)) {
                        // Administrative settlement preserves established
                        // propagation order and its isolated control faults.
                        this.#settleSelector(
                            scope,
                            dependency.node as AnySelector,
                        )
                    }
                }
            }
            if (scope.isSelectorDirty(selector)) {
                const graphStayedCurrent =
                    graphVersionBeforeDependencies ===
                    scope.getSelectorGraphVersion()
                if (session !== undefined && graphStayedCurrent) {
                    // Reuse the dynamically active session only when no old
                    // dependency published first. Its own publication is then
                    // attributable without changing base settlement ordering.
                    scope.serve(selector, session)
                } else {
                    scope.serve(
                        selector,
                        new SelectorEvaluationSession<AnyState>(),
                    )
                }
            }
            this.#updatePropagationStatus(scope, selector, PROPAGATION_SETTLED)
        } finally {
            this.#updatePropagationStatus(
                scope,
                selector,
                0,
                PROPAGATION_SETTLING,
            )
        }
    }

    #getPropagationStatus(
        scope: StoreScopeNode,
        selector: AnySelector,
    ): number {
        if (
            Object.is(this.#propagationStatusScope, scope) &&
            Object.is(this.#propagationStatusSelector, selector)
        ) {
            return this.#propagationStatusBits
        }
        return this.#propagationStatuses?.get(scope)?.get(selector) ?? 0
    }

    #updatePropagationStatus(
        scope: StoreScopeNode,
        selector: AnySelector,
        add: number,
        remove = 0,
    ): void {
        if (this.#propagationStatusScope === undefined) {
            this.#propagationStatusScope = scope
            this.#propagationStatusSelector = selector
            this.#propagationStatusBits = add & ~remove
            return
        }
        if (
            Object.is(this.#propagationStatusScope, scope) &&
            Object.is(this.#propagationStatusSelector, selector)
        ) {
            this.#propagationStatusBits =
                (this.#propagationStatusBits | add) & ~remove
            return
        }

        let statuses = this.#propagationStatuses
        if (statuses === undefined) {
            statuses = new Map()
            this.#propagationStatuses = statuses
        }
        let bySelector = statuses.get(scope)
        if (bySelector === undefined) {
            bySelector = new Map()
            statuses.set(scope, bySelector)
        }
        bySelector.set(
            selector,
            ((bySelector.get(selector) ?? 0) | add) & ~remove,
        )
    }

    latchPropagationControlFault(error: unknown): void {
        this.#propagationControlFault ??= error
    }

    #stageAlreadyInspectedAtomSet(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: AnyAtom,
        candidate: unknown,
        baseline: AtomDraftBaseline,
        session: SelectorEvaluationSession<AnyState>,
    ): void {
        const canonical =
            baseline.outcome.kind === "value"
                ? this.#canonicalizeAtomCandidate(
                      atom,
                      baseline.outcome.value,
                      candidate,
                      session,
                  )
                : candidate
        draft.stage(
            scope,
            Object.freeze({
                kind: "set",
                atom,
                value: canonical,
                publishDraftFallback:
                    baseline.reachesFallback && draft.hasFallback(atom),
            }),
        )
    }
}

class CommittedStoreTreeFacade implements CommittedStoreTree {
    declare readonly get: <Value>(state: State<Value>) => Value
    declare readonly sub: <Value>(
        state: State<Value>,
        callback: () => void,
    ) => () => void
    declare readonly set: CommittedStoreTree["set"]
    declare readonly update: CommittedStoreTree["update"]
    declare readonly reset: CommittedStoreTree["reset"]
    declare readonly delete: CommittedStoreTree["delete"]
    declare readonly txn: <Result>(
        callback: TransactionCallback<Result>,
        name?: string,
    ) => Result
    declare readonly scope: {
        (): CommittedStoreTree
        (id: string): CommittedStoreTree
    }
    declare readonly dispose: () => void

    constructor(
        host: CommittedStoreTreeHost,
        scope: StoreScopeNode,
        trace?: InternalStoreTreeTrace,
    ) {
        this.get = state => host.get(scope, state)
        this.sub = (state, callback) => host.sub(scope, state, callback)
        this.set = ((
            target: Atom<unknown> | CollectionRow<any, any>,
            value: unknown,
        ) =>
            host.mutate(
                undefined,
                scope,
                "set",
                target,
                value,
            )) as CommittedStoreTree["set"]
        this.update = ((
            target: Atom<unknown> | CollectionRow<any, any>,
            update: (current: any) => any,
        ) =>
            host.mutate(
                undefined,
                scope,
                "update",
                target,
                update,
            )) as CommittedStoreTree["update"]
        this.reset = ((target: Atom<unknown> | CollectionRow<any, any>) =>
            host.mutate(
                undefined,
                scope,
                "reset",
                target,
            )) as CommittedStoreTree["reset"]
        this.delete = ((row: CollectionRow<any, any>) =>
            host.mutate(
                undefined,
                scope,
                "delete",
                row,
            )) as CommittedStoreTree["delete"]
        this.txn = (callback, name) => host.txn(scope, callback, name)
        this.scope = function (id?: string): CommittedStoreTree {
            return host.scope(scope, arguments.length, id)
        }
        this.dispose = () => host.dispose(scope)
        scope.installFacade(this)
        brandRuntimeHandle(this, host.runtimeDomain.ownerToken)
        host.runtimeDomain.stores.set(this, scope)
        host.recordCounter("storeFacadesCreated")
        trace?.(0, this, scope)
        Object.freeze(this)
    }
}

const readAtomOptions = <Value>(
    options: AtomOptions<Value>,
): Pick<AtomDefinition, "equal" | "name"> => {
    if (options.equal !== undefined && typeof options.equal !== "function") {
        throw new TypeError("Atom equal must be a function")
    }
    return {
        ...(options.name === undefined ? {} : { name: options.name }),
        ...(options.equal === undefined
            ? {}
            : {
                  equal: options.equal as (
                      previous: unknown,
                      next: unknown,
                  ) => boolean,
              }),
    }
}

export const createCommittedStoreTreeDomain = (
    defaultInstrumentation?: InternalStoreTreeInstrumentation,
): InternalCommittedStoreTreeDomain => {
    const records: RuntimeDomainRecords = {
        states: new WeakSet(),
        atoms: new WeakMap(),
        selectors: new WeakMap(),
        stores: new WeakMap(),
        transactionCursors: new WeakMap(),
        ownerToken: Object.freeze({}),
        activity: undefined,
    }

    const atom = <Value>(
        fallback: Value,
        options: AtomOptions<Value> = {},
    ): Atom<Value> => {
        assertRuntimeDefinitionConstructionAllowed(records)
        const session = new SelectorEvaluationSession<AnyState>()
        const inspected = runGuardedCallback(records, session, () =>
            inspectSynchronousAtomValue(fallback),
        )
        if (inspected.kind === "error") throw inspected.error
        const handle = registerRuntimeStateHandle(
            records,
            makeStateHandle("atom"),
        ) as unknown as Atom<Value>
        records.atoms.set(
            handle,
            Object.freeze({
                fallback: Object.freeze({
                    kind: "eager" as const,
                    value: inspected.value,
                }),
                ...readAtomOptions(options),
            }),
        )
        return handle
    }

    const atomLazy = <Value>(
        initialize: () => Value,
        options: AtomOptions<Value> = {},
    ): Atom<Value> => {
        assertRuntimeDefinitionConstructionAllowed(records)
        if (typeof initialize !== "function") {
            throw new TypeError("atomLazy requires an initializer function")
        }
        const handle = registerRuntimeStateHandle(
            records,
            makeStateHandle("atom"),
        ) as unknown as Atom<Value>
        records.atoms.set(
            handle,
            Object.freeze({
                fallback: Object.freeze({
                    kind: "lazy",
                    initialize: initialize as () => unknown,
                }),
                ...readAtomOptions(options),
            }),
        )
        return handle
    }

    const selector = <Value>(
        get: (get: StateRead) => Value,
        options: SelectorOptions<Value> = {},
    ): Selector<Value> => {
        assertRuntimeDefinitionConstructionAllowed(records)
        if (typeof get !== "function") {
            throw new TypeError("selector requires a getter function")
        }
        if (
            options.equal !== undefined &&
            typeof options.equal !== "function"
        ) {
            throw new TypeError("selector equal must be a function")
        }
        const handle = registerRuntimeStateHandle(
            records,
            makeStateHandle("selector"),
        ) as unknown as Selector<Value>
        const definition: SelectorDefinition<AnyState, Value> = Object.freeze({
            node: handle as unknown as AnyState,
            get: get as (
                get: <DependencyValue>(node: AnyState) => DependencyValue,
            ) => Value,
            ...(options.name === undefined ? {} : { name: options.name }),
            ...(options.equal === undefined ? {} : { equal: options.equal }),
        })
        records.selectors.set(handle, definition)
        return handle
    }

    const storeScope = (value: unknown): StoreScopeNode | undefined => {
        const session = new SelectorEvaluationSession<AnyState>()
        if (classifyEntryOwner(records, value, session) === "invalid") {
            return undefined
        }
        return records.stores.get(value as object) as StoreScopeNode | undefined
    }

    const assertStore: CommittedStoreTreeAdapter["assertStore"] = (
        value: unknown,
    ): asserts value is CommittedStoreTree => {
        const scope = storeScope(value)
        assertStoreOperationAllowed(records, "adapter assertStore")
        if (scope === undefined) {
            throw new TypeError("assertStore requires a valid Store")
        }
    }

    const adapter: CommittedStoreTreeAdapter = Object.freeze({
        assertStore,
        read: <Value>(
            value: CommittedStoreTree,
            state: State<Value>,
        ): Value => {
            const scope = storeScope(value)
            if (scope === undefined) {
                assertStoreReadAllowed(records, "adapter read")
                throw new TypeError("read requires a valid Store")
            }
            return value.get(state)
        },
        subscribe: <Value>(
            value: CommittedStoreTree,
            state: State<Value>,
            callback: () => void,
        ): (() => void) => {
            const scope = storeScope(value)
            if (scope === undefined) {
                assertStoreOperationAllowed(records, "adapter subscribe")
                throw new TypeError("subscribe requires a valid Store")
            }
            return value.sub(state, callback)
        },
        readHydrationSnapshot: <Value>(
            value: CommittedStoreTree,
            state: State<Value>,
        ): Value => {
            const scope = storeScope(value)
            if (scope === undefined) {
                assertStoreOperationAllowed(
                    records,
                    "adapter readHydrationSnapshot",
                )
                throw new TypeError(
                    "readHydrationSnapshot requires a valid Store",
                )
            }
            return (
                scope.coordinator as CommittedStoreTreeHost
            ).readHydrationSnapshot(scope, state)
        },
    })

    const domain: InternalCommittedStoreTreeDomain = Object.freeze({
        [definitionDomainRecords]: records,
        atom,
        atomLazy,
        selector,
        adapter,
        createStoreTree: (
            instrumentation:
                | InternalStoreTreeInstrumentation
                | undefined = defaultInstrumentation,
            trace?: InternalStoreTreeTrace,
        ) => {
            assertStoreOperationAllowed(records, "createStoreTree")
            const host = new CommittedStoreTreeHost(
                records,
                instrumentation,
                trace,
            )
            return new CommittedStoreTreeFacade(host, host.rootScope, trace)
        },
    })
    return domain
}

export {
    CallbackCapabilityError,
    InvalidAtomComparatorResultError,
    InvalidSynchronousAtomValueError,
    InvalidTransactionCallbackResultError,
    InvalidTransactionTargetError,
    RuntimeMismatchError,
    SubscriberNotificationError,
    ScopeNotFoundError,
    SelectorCapabilityError,
    StoreDisposedError,
    StoreTreeMismatchError,
    TransactionClosedError,
    TransactionPhaseError,
}

export type {
    Atom,
    AtomOptions,
    AtomUpdater,
    CommittedStoreTree,
    CommittedStoreTreeAdapter,
    CommittedStoreTreeDomain,
    Collection,
    CollectionKey,
    CollectionOptions,
    CollectionRow,
    CollectionValue,
    RootTransaction,
    Selector,
    SelectorOptions,
    State,
    StateRead,
    TransactionCallback,
} from "./types"
