import type {
    SelectorDefinition,
    ServedSelectorOutcome,
} from "../selector-evaluator/types"
import { SelectorEvaluationSession } from "../selector-evaluator/types"
import {
    CallbackCapabilityError,
    InvalidAtomComparatorResultError,
    InvalidSynchronousAtomValueError,
    InvalidTransactionCallbackResultError,
    InvalidTransactionTargetError,
    RuntimeMismatchError,
    ScopeNotFoundError,
    SelectorCapabilityError,
    StoreDisposedError,
    StoreTreeMismatchError,
    TransactionClosedError,
    TransactionPhaseError,
    SubscriberNotificationError,
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
    runGuardedCallback,
    runLazyInitializer,
    runSelectorActivity,
    runSubscriberActivity,
    runTransactionActivity,
    runTransactionResultActivity,
    type AnyAtom,
    type AnyState,
    type AtomDefinition,
    type RuntimeDomainRecords,
    type SynchronousResult,
} from "./runtime-domain"
import {
    ScratchSelectorHost,
    type ResolvedScratchState,
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
    AtomUpdater,
    CommittedStoreTree,
    CommittedStoreTreeDomain,
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
    })

const STORE_TREE_COUNTER_COUNT = 32
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

    constructor(
        domain: RuntimeDomainRecords,
        instrumentation?: InternalStoreTreeInstrumentation,
    ) {
        this.#domain = domain
        this.#counters =
            instrumentation === undefined
                ? undefined
                : internalInstrumentationCounters.get(instrumentation)
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
            (!this.#domain.atoms.has(node) && !this.#domain.selectors.has(node))
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

    set<Value>(scope: StoreScopeNode, atom: Atom<Value>, value: Value): void {
        this.#runDirectAtomIntent(scope, atom, "StoreTree.set", "set", value)
    }

    update<Value>(
        scope: StoreScopeNode,
        atom: Atom<Value>,
        update: AtomUpdater<Value>,
    ): void {
        this.#runDirectAtomIntent(
            scope,
            atom,
            "StoreTree.update",
            "update",
            update,
        )
    }

    reset<Value>(scope: StoreScopeNode, atom: Atom<Value>): void {
        this.#runDirectAtomIntent(scope, atom, "StoreTree.reset", "reset")
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
    ): Result {
        assertStoreOperationAllowed(this.#domain, "StoreTree.txn")
        this.#assertScopeLive(scope)
        if (typeof callback !== "function") {
            throw new TypeError("StoreTree.txn requires a callback function")
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
            throw new TypeError("Transaction.get requires a readable State")
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

    transactionSet<Value>(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: Atom<Value>,
        value: Value,
    ): void {
        const node = atom as unknown as AnyAtom
        const session = new SelectorEvaluationSession<AnyState>()
        this.#validateTransactionAtom(
            draft,
            scope,
            node,
            session,
            "Transaction.set",
        )
        this.#stageAtomSet(draft, scope, node, value, session)
    }

    transactionUpdate<Value>(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: Atom<Value>,
        update: AtomUpdater<Value>,
    ): void {
        const node = atom as unknown as AnyAtom
        const session = new SelectorEvaluationSession<AnyState>()
        this.#validateTransactionAtom(
            draft,
            scope,
            node,
            session,
            "Transaction.update",
        )
        this.#stageAtomUpdate(
            draft,
            scope,
            node,
            update as (current: unknown) => unknown,
            session,
            "Transaction.update",
        )
    }

    transactionReset<Value>(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: Atom<Value>,
    ): void {
        const node = atom as unknown as AnyAtom
        const session = new SelectorEvaluationSession<AnyState>()
        this.#validateTransactionAtom(
            draft,
            scope,
            node,
            session,
            "Transaction.reset",
        )
        this.#stageAtomReset(draft, scope, node, session)
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
    ): ScratchSelectorHost<AnyState> {
        this.recordCounter("scratchHostAllocations")
        return new ScratchSelectorHost<AnyState>(
            Object.freeze({
                resolveState: (
                    node: AnyState,
                    session: SelectorEvaluationSession<AnyState>,
                ) => this.#resolveScratchState(node, session),
                readDraftAtomOutcome: (
                    atom: AnyState,
                    session: SelectorEvaluationSession<AnyState>,
                ) =>
                    this.#readDraftAtomOutcome(
                        draft,
                        scope,
                        atom as AnyAtom,
                        session,
                    ),
                captureCommittedSelectorSuccess: (selector: AnyState) =>
                    scope.captureCommittedSelectorSuccess(
                        selector as AnySelector,
                    ),
                runSelectorActivity: <Result>(
                    session: SelectorEvaluationSession<AnyState>,
                    operation: () => Result,
                ): Result =>
                    runSelectorActivity(this.#domain, session, operation),
            }),
            draft.generation,
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
        if (definition === undefined) {
            throw new TypeError("Unknown scratch StoreTree State")
        }
        return Object.freeze({ kind: "selector", definition })
    }

    #createChildScope(
        parent: StoreScopeNode,
        name?: string,
    ): CommittedStoreTree {
        const child = new StoreScopeNode(this, parent, name)
        this.recordCounter("scopeNodesCreated")
        const facade = new CommittedStoreTreeFacade(this, child)
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

    #validateDirectAtom(
        scope: StoreScopeNode,
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
        operation: string,
    ): void {
        const ownerStatus = classifyEntryOwner(this.#domain, atom, session)
        assertStoreOperationAllowed(this.#domain, operation)
        this.#assertScopeLive(scope)
        this.#assertAtomKind(atom, ownerStatus, operation)
    }

    #runDirectAtomIntent<Value>(
        scope: StoreScopeNode,
        atom: Atom<Value>,
        operation: string,
        intent: "set" | "update" | "reset",
        input?: unknown,
    ): void {
        const node = atom as unknown as AnyAtom
        const session = new SelectorEvaluationSession<AnyState>()
        this.#validateDirectAtom(scope, node, session, operation)
        const draft = this.#createDraft()
        try {
            if (intent === "set") {
                this.#stageAtomSet(draft, scope, node, input, session)
            } else if (intent === "update") {
                this.#stageAtomUpdate(
                    draft,
                    scope,
                    node,
                    input as (current: unknown) => unknown,
                    session,
                    operation,
                )
            } else {
                this.#stageAtomReset(draft, scope, node, session)
            }
        } catch (error) {
            draft.close()
            draft.release()
            throw error
        }
        draft.close()
        try {
            this.#commitDraft(draft)
        } finally {
            draft.release()
        }
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

    #validateTransactionAtom(
        draft: TreeDraft,
        scope: StoreScopeNode,
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
        operation: string,
    ): void {
        const ownerStatus = classifyEntryOwner(this.#domain, atom, session)
        assertCursorOperationAllowed(
            this.#domain,
            draft.transaction,
            draft.active,
        )
        this.#assertScopeLive(scope)
        this.#assertAtomKind(atom, ownerStatus, operation)
    }

    #assertAtomKind(
        atom: AnyAtom,
        ownerStatus: "local" | "invalid",
        operation: string,
    ): void {
        if (ownerStatus === "invalid" || !this.#domain.atoms.has(atom)) {
            throw new TypeError(`${operation} requires a valid Atom`)
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
        if (!draft.hasIntents) return

        const singleIntent = draft.singleIntent
        const singleScope = draft.singleIntentScope
        if (
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
         *                   -> apply every owner -> rewire AtomViews
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
        if (firstPlan === undefined) return

        // Apply every fallback publication and owned source before propagation.
        this.#publishPlanFallback(draft, firstPlan)
        if (remainingPlan !== undefined) {
            for (const entry of remainingPlan) {
                this.#publishPlanFallback(draft, entry)
            }
        }

        let ownershipChanged = this.#applyPlanOwner(firstPlan)
        if (remainingPlan !== undefined) {
            for (const entry of remainingPlan) {
                const entryOwnershipChanged = this.#applyPlanOwner(entry)
                ownershipChanged ||= entryOwnershipChanged
            }
        }

        // Rewire every materialized target only after every local source applies.
        this.#rewirePlanAtomView(firstPlan)
        if (remainingPlan !== undefined) {
            for (const entry of remainingPlan) {
                this.#rewirePlanAtomView(entry)
            }
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
            if (ownershipChanged) {
                this.#sourceEpoch += 1
                this.recordCounter("sourceEpoch")
            }
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
        } else {
            scope.atomOverrides.delete(intent.atom)
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

    prepareSelectorRead(scope: StoreScopeNode, selector: AnySelector): void {
        if (this.#propagationQueue === undefined) return
        this.#settleSelector(scope, selector)
    }

    #settleSelector(scope: StoreScopeNode, selector: AnySelector): void {
        const status = this.#getPropagationStatus(scope, selector)
        if ((status & (PROPAGATION_SETTLED | PROPAGATION_SETTLING)) !== 0) {
            return
        }
        this.#updatePropagationStatus(scope, selector, PROPAGATION_SETTLING)
        try {
            const dependencies =
                scope.getCommittedSelectorDependencies(selector)
            if (dependencies !== undefined) {
                for (const dependency of dependencies) {
                    if (this.#domain.selectors.has(dependency.node)) {
                        this.#settleSelector(
                            scope,
                            dependency.node as AnySelector,
                        )
                    }
                }
            }
            if (scope.isSelectorDirty(selector)) {
                scope.serve(selector, new SelectorEvaluationSession<AnyState>())
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
    readonly #host: CommittedStoreTreeHost
    readonly #scope: StoreScopeNode

    constructor(host: CommittedStoreTreeHost, scope: StoreScopeNode) {
        this.#host = host
        this.#scope = scope
        scope.installFacade(this)
        brandRuntimeHandle(this, host.runtimeDomain.ownerToken)
        host.runtimeDomain.stores.set(this, scope)
        host.recordCounter("storeFacadesCreated")
        Object.freeze(this)
    }

    get<Value>(state: State<Value>): Value {
        return this.#host.get(this.#scope, state)
    }

    sub<Value>(state: State<Value>, callback: () => void): () => void {
        return this.#host.sub(this.#scope, state, callback)
    }

    set<Value>(atom: Atom<Value>, value: Value): void {
        this.#host.set(this.#scope, atom, value)
    }

    update<Value>(atom: Atom<Value>, update: AtomUpdater<Value>): void {
        this.#host.update(this.#scope, atom, update)
    }

    reset<Value>(atom: Atom<Value>): void {
        this.#host.reset(this.#scope, atom)
    }

    txn<Result>(callback: TransactionCallback<Result>): Result {
        return this.#host.txn(this.#scope, callback)
    }

    scope(): CommittedStoreTree
    scope(id: string): CommittedStoreTree
    scope(id?: string): CommittedStoreTree {
        return this.#host.scope(this.#scope, arguments.length, id)
    }

    dispose(): void {
        this.#host.dispose(this.#scope)
    }
}

const readAtomOptions = <Value>(
    options: AtomOptions<Value>,
): Pick<AtomDefinition, "equal"> => {
    if (options.equal !== undefined && typeof options.equal !== "function") {
        throw new TypeError("Atom equal must be a function")
    }
    return options.equal === undefined
        ? {}
        : {
              equal: options.equal as (
                  previous: unknown,
                  next: unknown,
              ) => boolean,
          }
}

export const createCommittedStoreTreeDomain = (
    instrumentation?: InternalStoreTreeInstrumentation,
): CommittedStoreTreeDomain => {
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
        const session = new SelectorEvaluationSession<AnyState>()
        const inspected = runGuardedCallback(records, session, () =>
            inspectSynchronousAtomValue(fallback),
        )
        if (inspected.kind === "error") throw inspected.error
        const handle = makeStateHandle(
            "atom",
            records.ownerToken,
        ) as unknown as Atom<Value>
        records.states.add(handle)
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
        if (typeof initialize !== "function") {
            throw new TypeError("atomLazy requires an initializer function")
        }
        const handle = makeStateHandle(
            "atom",
            records.ownerToken,
        ) as unknown as Atom<Value>
        records.states.add(handle)
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
        if (typeof get !== "function") {
            throw new TypeError("selector requires a getter function")
        }
        if (
            options.equal !== undefined &&
            typeof options.equal !== "function"
        ) {
            throw new TypeError("selector equal must be a function")
        }
        const handle = makeStateHandle(
            "selector",
            records.ownerToken,
        ) as unknown as Selector<Value>
        const definition: SelectorDefinition<AnyState, Value> = Object.freeze({
            node: handle as unknown as AnyState,
            get: get as (
                get: <DependencyValue>(node: AnyState) => DependencyValue,
            ) => Value,
            ...(options.equal === undefined ? {} : { equal: options.equal }),
        })
        records.states.add(handle)
        records.selectors.set(handle, definition)
        return handle
    }

    return Object.freeze({
        atom,
        atomLazy,
        selector,
        createStoreTree: () => {
            assertStoreOperationAllowed(records, "createStoreTree")
            const host = new CommittedStoreTreeHost(records, instrumentation)
            return new CommittedStoreTreeFacade(host, host.rootScope)
        },
    })
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
    CommittedStoreTreeDomain,
    RootTransaction,
    Selector,
    SelectorOptions,
    State,
    StateRead,
    TransactionCallback,
} from "./types"
