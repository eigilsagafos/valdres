import { evaluateSelector } from "../selector-evaluator/evaluate"
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
    CallbackCapabilityError,
    InvalidAtomComparatorResultError,
    InvalidSynchronousAtomValueError,
    InvalidTransactionCallbackResultError,
    RuntimeMismatchError,
    SelectorCapabilityError,
    TransactionClosedError,
    TransactionPhaseError,
    assertCursorOperationAllowed,
    assertStoreOperationAllowed,
    classifyEntryOwner,
    classifyOwner,
    containThenable,
    inspectSynchronousAtomValue,
    inspectThenable,
    makeStateHandle,
    runGuardedCallback,
    runLazyInitializer,
    runSelectorActivity,
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
    TreeDraft,
    createRootTransactionCursor,
    inspectTransactionCallbackResult,
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
    Selector,
    SelectorOptions,
    State,
    StateRead,
    TransactionCallback,
} from "./types"

type AnySelector = Selector<any>
type OutcomeToken = Readonly<{ id: number }>

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

interface AtomApplyPlan {
    readonly intent: AtomIntent
    readonly before: DraftAtomOutcome
    readonly after: DraftAtomOutcome
    readonly ownershipChanged: boolean
    readonly effectiveChanged: boolean
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

class CommittedStoreTreeHost
    implements
        CommittedStoreTree,
        SelectorEvaluationHost<AnyState, OutcomeToken>,
        TreeTransactionHost
{
    readonly #fallbackRecords = new Map<AnyAtom, DraftAtomOutcome>()
    readonly #atomOverrides = new Map<AnyAtom, unknown>()
    readonly #atomRecords = new Map<
        AnyAtom,
        ServedSelectorOutcome<OutcomeToken>
    >()
    readonly #selectorRecords = new Map<AnySelector, SelectorRecord>()
    readonly #reverseEdges = new Map<AnyState, Set<AnySelector>>()
    readonly #dirtySelectors = new Set<AnySelector>()
    #nextToken = 1
    #sourceEpoch = 0
    #postSourceApply = false
    #propagationQueue: AnySelector[] | undefined
    #propagationQueued: Set<AnySelector> | undefined
    #propagationControlFault: unknown | undefined
    readonly #domain: RuntimeDomainRecords

    constructor(domain: RuntimeDomainRecords) {
        this.#domain = domain
    }

    get runtimeDomain(): RuntimeDomainRecords {
        return this.#domain
    }

    get<Value>(state: State<Value>): Value {
        const session = new SelectorEvaluationSession<AnyState>()
        const node = state as unknown as AnyState
        const ownerStatus = classifyEntryOwner(this.#domain, node, session)
        assertStoreOperationAllowed(this.#domain, "StoreTree.get")
        if (ownerStatus === "invalid") {
            throw new TypeError("StoreTree.get requires a valid State")
        }
        const served = this.serve(node, session)
        if (served.outcome.kind !== "value") throw served.outcome.error
        return served.outcome.value as Value
    }

    set<Value>(atom: Atom<Value>, value: Value): void {
        this.#runDirectAtomIntent(atom, "StoreTree.set", "set", value)
    }

    update<Value>(atom: Atom<Value>, update: AtomUpdater<Value>): void {
        this.#runDirectAtomIntent(atom, "StoreTree.update", "update", update)
    }

    reset<Value>(atom: Atom<Value>): void {
        this.#runDirectAtomIntent(atom, "StoreTree.reset", "reset")
    }

    txn<Result>(callback: TransactionCallback<Result>): Result {
        assertStoreOperationAllowed(this.#domain, "StoreTree.txn")
        if (typeof callback !== "function") {
            throw new TypeError("StoreTree.txn requires a callback function")
        }

        const draft = new TreeDraft()
        const cursor = createRootTransactionCursor(this, draft)
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
            throw error
        }
        draft.close()

        const resultSession = new SelectorEvaluationSession<AnyState>()
        runTransactionResultActivity(this.#domain, resultSession, () =>
            inspectTransactionCallbackResult(result),
        )
        this.#commitDraft(draft)
        return result
    }

    transactionGet<Value>(draft: TreeDraft, state: State<Value>): Value {
        const node = state as unknown as AnyState
        const session = new SelectorEvaluationSession<AnyState>()
        const ownerStatus = classifyEntryOwner(this.#domain, node, session)
        assertCursorOperationAllowed(
            this.#domain,
            draft.transaction,
            draft.active,
        )
        if (ownerStatus === "invalid") {
            throw new TypeError("Transaction.get requires a valid State")
        }
        if (this.#domain.atoms.has(node)) {
            const outcome = this.#readDraftAtomOutcome(
                draft,
                node as AnyAtom,
                session,
            )
            if (outcome.kind !== "value") throw outcome.error
            return outcome.value as Value
        }
        if (!this.#domain.selectors.has(node)) {
            throw new TypeError("Transaction.get requires a readable State")
        }
        const scratchHost =
            draft.scratchHost ?? this.#createScratchSelectorHost(draft)
        draft.scratchHost ??= scratchHost
        return scratchHost.readSelector<Value>(node)
    }

    transactionSet<Value>(
        draft: TreeDraft,
        atom: Atom<Value>,
        value: Value,
    ): void {
        const node = atom as unknown as AnyAtom
        const session = new SelectorEvaluationSession<AnyState>()
        this.#validateTransactionAtom(draft, node, session, "Transaction.set")
        this.#stageAtomSet(draft, node, value, session)
    }

    transactionUpdate<Value>(
        draft: TreeDraft,
        atom: Atom<Value>,
        update: AtomUpdater<Value>,
    ): void {
        const node = atom as unknown as AnyAtom
        const session = new SelectorEvaluationSession<AnyState>()
        this.#validateTransactionAtom(
            draft,
            node,
            session,
            "Transaction.update",
        )
        this.#stageAtomUpdate(
            draft,
            node,
            update as (current: unknown) => unknown,
            session,
            "Transaction.update",
        )
    }

    transactionReset<Value>(draft: TreeDraft, atom: Atom<Value>): void {
        const node = atom as unknown as AnyAtom
        const session = new SelectorEvaluationSession<AnyState>()
        this.#validateTransactionAtom(draft, node, session, "Transaction.reset")
        this.#stageAtomReset(draft, node, session)
    }

    serve(
        node: AnyState,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken> {
        if (classifyOwner(this.#domain, node, session) === "invalid") {
            throw new TypeError("Selector get requires a valid State")
        }
        if (this.#domain.atoms.has(node)) {
            return this.#serveAtom(node as AnyAtom, session)
        }

        const definition = this.#domain.selectors.get(node)
        if (definition === undefined) {
            throw new TypeError("Unknown committed StoreTree state")
        }
        const selector = node as AnySelector
        const current = this.#selectorRecords.get(selector)
        if (current !== undefined && !this.#dirtySelectors.has(selector)) {
            return current.served
        }

        const proposal = runSelectorActivity(this.#domain, session, () =>
            evaluateSelector(definition, this, session),
        )
        if (
            proposal.outcome.kind === "control-error" &&
            !this.#postSourceApply
        ) {
            throw proposal.outcome.error
        }
        return this.#installSelectorProposal(selector, proposal)
    }

    getSelectorRecord(
        node: AnyState,
    ): SelectorRecordView<AnyState, OutcomeToken> | undefined {
        const record = this.#selectorRecords.get(node as AnySelector)
        return record === undefined
            ? undefined
            : Object.freeze({ dependencies: record.dependencies })
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
        return Object.freeze({ id: this.#nextToken++ })
    }

    #createScratchSelectorHost(
        draft: TreeDraft,
    ): ScratchSelectorHost<AnyState> {
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
                    this.#readDraftAtomOutcome(draft, atom as AnyAtom, session),
                captureCommittedSelectorSuccess: (selector: AnyState) => {
                    const lastSuccess = this.#selectorRecords.get(
                        selector as AnySelector,
                    )?.lastSuccess
                    return lastSuccess === undefined
                        ? undefined
                        : Object.freeze({ value: lastSuccess.value })
                },
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

    #validateDirectAtom(
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
        operation: string,
    ): void {
        const ownerStatus = classifyEntryOwner(this.#domain, atom, session)
        assertStoreOperationAllowed(this.#domain, operation)
        this.#assertAtomKind(atom, ownerStatus, operation)
    }

    #runDirectAtomIntent<Value>(
        atom: Atom<Value>,
        operation: string,
        intent: "set" | "update" | "reset",
        input?: unknown,
    ): void {
        const draft = new TreeDraft()
        try {
            const node = atom as unknown as AnyAtom
            const session = new SelectorEvaluationSession<AnyState>()
            this.#validateDirectAtom(node, session, operation)
            if (intent === "set") {
                this.#stageAtomSet(draft, node, input, session)
            } else if (intent === "update") {
                this.#stageAtomUpdate(
                    draft,
                    node,
                    input as (current: unknown) => unknown,
                    session,
                    operation,
                )
            } else {
                this.#stageAtomReset(draft, node, session)
            }
        } catch (error) {
            draft.close()
            throw error
        }
        draft.close()
        this.#commitDraft(draft)
    }

    #validateTransactionAtom(
        draft: TreeDraft,
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
        atom: AnyAtom,
        value: unknown,
        session: SelectorEvaluationSession<AnyState>,
    ): void {
        const inspected = runGuardedCallback(this.#domain, session, () =>
            inspectSynchronousAtomValue(value),
        )
        if (inspected.kind === "error") throw inspected.error

        const baseline = this.#getDraftAtomBaseline(draft, atom, session)
        const canonical =
            baseline.outcome.kind === "value"
                ? this.#canonicalizeAtomCandidate(
                      atom,
                      baseline.outcome.value,
                      inspected.value,
                      session,
                  )
                : inspected.value
        draft.stage(
            Object.freeze({
                kind: "set",
                atom,
                value: canonical,
                publishDraftFallback:
                    baseline.reachesFallback && draft.fallbackMemo.has(atom),
            }),
        )
    }

    #stageAtomUpdate(
        draft: TreeDraft,
        atom: AnyAtom,
        update: (current: unknown) => unknown,
        session: SelectorEvaluationSession<AnyState>,
        operation: string,
    ): void {
        if (typeof update !== "function") {
            throw new TypeError(`${operation} requires an updater function`)
        }

        const current = this.#readDraftAtomOutcome(draft, atom, session)
        if (current.kind !== "value") throw current.error
        const candidate = this.#runAtomUpdater(update, current.value, session)
        this.#stageAtomSet(draft, atom, candidate, session)
    }

    #stageAtomReset(
        draft: TreeDraft,
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): void {
        this.#getDraftAtomBaseline(draft, atom, session)
        const fallback = this.#getDraftFallbackOutcome(draft, atom, session)
        if (fallback.kind !== "value") throw fallback.error
        draft.stage(
            Object.freeze({
                kind: "reset",
                atom,
                fallback,
                publishDraftFallback: draft.fallbackMemo.has(atom),
            }),
        )
    }

    #getDraftAtomBaseline(
        draft: TreeDraft,
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): AtomDraftBaseline {
        const existing = draft.atomBaselines.get(atom)
        if (existing !== undefined) return existing
        const owned = this.#atomOverrides.has(atom)
        const baseline = Object.freeze({
            owned,
            outcome: owned
                ? valueOutcome(this.#atomOverrides.get(atom))
                : this.#getDraftFallbackOutcome(draft, atom, session),
            reachesFallback: !owned,
        })
        draft.atomBaselines.set(atom, baseline)
        return baseline
    }

    #readDraftAtomOutcome(
        draft: TreeDraft,
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): DraftAtomOutcome {
        const intent = draft.intents.get(atom)
        if (intent?.kind === "set") return valueOutcome(intent.value)
        if (intent?.kind === "reset") return intent.fallback
        if (this.#atomOverrides.has(atom)) {
            return valueOutcome(this.#atomOverrides.get(atom))
        }
        return this.#getDraftFallbackOutcome(draft, atom, session)
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
        const memoized = draft.fallbackMemo.get(atom)
        if (memoized !== undefined) return memoized
        const outcome = fromSynchronousResult(
            runGuardedCallback(this.#domain, session, () =>
                runLazyInitializer(initialize),
            ),
        )
        draft.fallbackMemo.set(atom, outcome)
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
        if (draft.intents.size === 0) return

        // Final preflight: all outcomes and comparator decisions are inert.
        const plan: AtomApplyPlan[] = []
        for (const intent of draft.intents.values()) {
            const baseline = draft.atomBaselines.get(intent.atom)
            if (baseline === undefined) {
                throw new Error("TreeDraft atom baseline is missing")
            }
            const after =
                intent.kind === "set"
                    ? valueOutcome(intent.value)
                    : intent.fallback
            const ownershipChanged =
                intent.kind === "set"
                    ? !baseline.owned ||
                      !Object.is(
                          this.#atomOverrides.get(intent.atom),
                          intent.value,
                      )
                    : baseline.owned
            plan.push(
                Object.freeze({
                    intent,
                    before: baseline.outcome,
                    after,
                    ownershipChanged,
                    effectiveChanged: !sameAtomOutcome(baseline.outcome, after),
                }),
            )
        }

        // Apply every fallback publication and owned source before propagation.
        for (const entry of plan) {
            if (!entry.intent.publishDraftFallback) continue
            const fallback = draft.fallbackMemo.get(entry.intent.atom)
            if (fallback !== undefined) {
                this.#fallbackRecords.set(entry.intent.atom, fallback)
            }
        }

        const changedSources: AnyAtom[] = []
        let ownershipChanged = false
        for (const entry of plan) {
            const { intent } = entry
            if (intent.kind === "set") {
                this.#atomOverrides.set(intent.atom, intent.value)
            } else {
                this.#atomOverrides.delete(intent.atom)
            }
            ownershipChanged ||= entry.ownershipChanged
            if (!entry.effectiveChanged) continue
            this.#atomRecords.set(
                intent.atom,
                Object.freeze({
                    token: this.createOutcomeToken(),
                    outcome: entry.after,
                }),
            )
            changedSources.push(intent.atom)
        }
        if (ownershipChanged) this.#sourceEpoch += 1
        this.#propagateFromSources(changedSources)
    }

    #serveAtom(
        atom: AnyAtom,
        session: SelectorEvaluationSession<AnyState>,
    ): ServedSelectorOutcome<OutcomeToken> {
        const current = this.#atomRecords.get(atom)
        if (current !== undefined) return current

        const outcome = this.#atomOverrides.has(atom)
            ? valueOutcome(this.#atomOverrides.get(atom))
            : this.#getCommittedFallbackOutcome(atom, session)
        const served = Object.freeze({
            token: this.createOutcomeToken(),
            outcome,
        })
        this.#atomRecords.set(atom, served)
        return served
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
        return outcome
    }

    #atomDefinition(atom: AnyAtom): AtomDefinition {
        const definition = this.#domain.atoms.get(atom)
        if (definition === undefined) {
            throw new TypeError("Unknown committed StoreTree Atom")
        }
        return definition
    }

    #installSelectorProposal(
        selector: AnySelector,
        proposal: SelectorEvaluationProposal<AnyState, OutcomeToken>,
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

        this.#replaceReverseEdges(
            selector,
            previous?.dependencies ?? EMPTY_DEPENDENCIES,
            proposal.dependencies,
        )
        this.#selectorRecords.set(selector, record)
        this.#dirtySelectors.delete(selector)

        if (
            previous !== undefined &&
            !Object.is(previous.served.token, proposal.token)
        ) {
            this.#enqueueDependents(selector)
        }
        if (
            proposal.outcome.kind === "control-error" &&
            this.#propagationControlFault === undefined
        ) {
            this.#propagationControlFault = proposal.outcome.error
        }
        return served
    }

    #replaceReverseEdges(
        selector: AnySelector,
        previous: readonly SelectorDependencySnapshot<AnyState, OutcomeToken>[],
        next: readonly SelectorDependencySnapshot<AnyState, OutcomeToken>[],
    ): void {
        for (const dependency of previous) {
            const dependents = this.#reverseEdges.get(dependency.node)
            dependents?.delete(selector)
            if (dependents?.size === 0) {
                this.#reverseEdges.delete(dependency.node)
            }
        }
        for (const dependency of next) {
            let dependents = this.#reverseEdges.get(dependency.node)
            if (dependents === undefined) {
                dependents = new Set()
                this.#reverseEdges.set(dependency.node, dependents)
            }
            dependents.add(selector)
        }
    }

    #propagateFromSources(sources: readonly AnyState[]): void {
        if (sources.length === 0) return
        this.#propagationQueue = []
        this.#propagationQueued = new Set()
        this.#propagationControlFault = undefined
        this.#postSourceApply = true
        try {
            for (const source of sources) this.#enqueueDependents(source)
            let cursor = 0
            while (cursor < this.#propagationQueue.length) {
                const selector = this.#propagationQueue[cursor++]!
                if (!this.#dirtySelectors.has(selector)) continue
                this.serve(selector, new SelectorEvaluationSession<AnyState>())
            }
        } finally {
            this.#postSourceApply = false
            this.#propagationQueue = undefined
            this.#propagationQueued = undefined
        }
        if (this.#propagationControlFault !== undefined) {
            throw this.#propagationControlFault
        }
    }

    #enqueueDependents(node: AnyState): void {
        if (
            this.#propagationQueue === undefined ||
            this.#propagationQueued === undefined
        ) {
            return
        }
        for (const selector of this.#reverseEdges.get(node) ?? []) {
            this.#dirtySelectors.add(selector)
            if (this.#propagationQueued.has(selector)) continue
            this.#propagationQueued.add(selector)
            this.#propagationQueue.push(selector)
        }
    }
}

class CommittedStoreTreeFacade implements CommittedStoreTree {
    readonly #host: CommittedStoreTreeHost

    constructor(domain: RuntimeDomainRecords) {
        this.#host = new CommittedStoreTreeHost(domain)
        Object.freeze(this)
    }

    get<Value>(state: State<Value>): Value {
        return this.#host.get(state)
    }

    set<Value>(atom: Atom<Value>, value: Value): void {
        this.#host.set(atom, value)
    }

    update<Value>(atom: Atom<Value>, update: AtomUpdater<Value>): void {
        this.#host.update(atom, update)
    }

    reset<Value>(atom: Atom<Value>): void {
        this.#host.reset(atom)
    }

    txn<Result>(callback: TransactionCallback<Result>): Result {
        return this.#host.txn(callback)
    }
}

const EMPTY_DEPENDENCIES = Object.freeze(
    [],
) as readonly SelectorDependencySnapshot<AnyState, OutcomeToken>[]

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

export const createCommittedStoreTreeDomain = (): CommittedStoreTreeDomain => {
    const records: RuntimeDomainRecords = {
        states: new WeakSet(),
        atoms: new WeakMap(),
        selectors: new WeakMap(),
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
            return new CommittedStoreTreeFacade(records)
        },
    })
}

export {
    CallbackCapabilityError,
    InvalidAtomComparatorResultError,
    InvalidSynchronousAtomValueError,
    InvalidTransactionCallbackResultError,
    RuntimeMismatchError,
    SelectorCapabilityError,
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
